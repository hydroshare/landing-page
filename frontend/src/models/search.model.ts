import { Model } from "@vuex-orm/core";
import { ENDPOINTS } from "@/constants";
import { getQueryString } from "@/util";
import {
  IResult,
  ISearchParams,
  ITypeaheadParams,
} from "@/types";

export interface ISearchState {
  results: IResult[];
  contentTypes: string[];
  isFetchingContentTypes: boolean;
}

export default class Search extends Model {
  static entity = "search";

  static abortController = new AbortController()

  static fields() {
    return {};
  }

  static get $state(): any {
    return this.store().state.entities[this.entity];
  }

  static state(): ISearchState {
    return {
      results: [],
      contentTypes: [],
      isFetchingContentTypes: true,
    };
  }

  /** Performs a search and stores the result in state.results.
   * @returns a boolean indicating if the query has more pages that can be fetched with `fetchMore` method
   */
  public static async search(params: ISearchParams) {
    try {
      this.abortController.abort("[Search]: Searching...")
      this.abortController = new AbortController()
      const response: Response = await fetch(
        `${ENDPOINTS.search}?${getQueryString(params)}`, { signal: this.abortController.signal }
      );

      if (!response.ok) {
        throw new Error("Network response was not OK");
      }

      const incoming = await response.json();
      this.commit((state) => {
        if (Array.isArray(incoming)) {
          state.results = incoming.map(this._parseResult);
        }
      });

      // If the number of items in this page equals the page size, then there could be more items in the next page.
      return incoming.length === params.pageSize;
    }
    catch (e) {
      console.log(e)
    }
  }

  /**
   * Clear all results
   */
  public static clearResults() {
    this.commit((state) => {
      state.results = [] as IResult[];
    });
  }

  /** Fetches the next page indicated by params.pageNumber and appends the incoming items to `state.results`
   * @returns a boolean indicating if the query has more pages that can be fetched
   */
  public static async fetchMore(params: ISearchParams): Promise<boolean> {
    const response: Response = await fetch(
      `${ENDPOINTS.search}?${getQueryString(params)}`,
    );

    if (!response.ok) {
      throw new Error("Network response was not OK");
    }

    const incoming = await response.json();

    this.commit((state) => {
      state.results = [
        ...state.results,
        ...incoming.map(this._parseResult),
      ] as IResult[];
    });

    return incoming.length === params.pageSize;
  }

  /** Performs a typeahead search and returns the results */
  public static async typeahead(params: ITypeaheadParams): Promise<any[]> {
    const response: Response = await fetch(
      `${ENDPOINTS.typeahead}?${getQueryString(params)}`,
    );
    if (!response.ok) {
      throw new Error("Network response was not OK");
    }
    const data = await response.json();
    return data;
  }

  /** Fetches the list of content types and updates the state */
  public static async fetchContentTypes(): Promise<void> {
    const response: Response = await fetch(ENDPOINTS.contentTypes);

    if (!response.ok) {
      throw new Error("Failed to fetch content types");
    }

    const contentTypes: string[] = await response.json();
    if (contentTypes) {
      this.commit((state) => {
        state.contentTypes = contentTypes.filter(contentType => contentType !== "CompositeResource");
      });
    }
    this.commit((state) => {
      state.isFetchingContentTypes = false
    })
  }

  /** Transform raw result data from API into `IResult` shaped objects */
  private static _parseResult(rawResult: any): IResult {
    return {
      creator: rawResult.creator.map((c: any) => c.name) || [],
      dateCreated: rawResult.dateCreated || "",
      datePublished: rawResult.datePublished || "",
      lastModified: rawResult.dateModified || "",
      description: rawResult.description || "",
      funding: rawResult.funding?.map((f: any) => f.name || f.funder.name) || [],
      highlights: rawResult.highlights || [],
      id: rawResult["_id"],
      keywords: Search._getKeywords(rawResult.keywords),
      license: rawResult.license?.name || "",
      name: rawResult.name || "",
      score: rawResult.score || 0,
      spatialCoverage: rawResult.spatialCoverage?.geo || [],
      url: rawResult.url || "",
      identifier: rawResult.identifier[0] || "",
      contentType: rawResult.additionalType || "",
      sharingStatus: rawResult.creativeWorkStatus?.name || ""
    };
  }

  private static _getKeywords(rawKeywords: any): string[] {
    return (
      rawKeywords.map((k) => {
        if (typeof k === "string") {
          return k;
        }
        if (typeof k === "object") {
          return k.name;
        }
      }) || []
    );
  }
}
