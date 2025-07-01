import type { ViteSSGContext } from "vite-ssg";

export type UserModule = (ctx: ViteSSGContext) => void;

export interface IResult {
  id: string;
  creator: string[];
  dateCreated: string;
  datePublished: string;
  lastModified: string;
  description: string;
  highlights: {
    path: string;
    score: number;
    texts: {
      type: string;
      value: string;
    }[];
  }[];
  license: string;
  keywords: string[];
  name: string;
  score: number; // unused for now...
  url: string;
  identifier: string;
  funding: string[];
  spatialCoverage: any;
  contentType: string;
  sharingStatus: string;
  _showMore?: boolean; // Used to toggle 'show more...' button
}

export interface IHint {
  type: EnumHistoryTypes;
  key: string;
}

export interface ISearchFilter {
  publicationYear: {
    min: number;
    max: number;
    isActive: boolean;
  };
  creationDate: {
    min: number;
    max: number;
    isActive: boolean;
  };
  dataCoverage: {
    min: number;
    max: number;
    isActive: boolean;
  };
  contentType: {
    value: string[] | null;
    isActive: boolean;
  };
  availability: {
    options: string[];
    value: string[] | null;
    isActive: boolean;
  };
  creatorName: string;
  contributorName: string;
  ownerName: string;
  subject: string;
  fundingFunderName: string;
}

export interface ISearchParams {
  term: string;
  pageSize: number;
  pageNumber: number;
  publishedStart?: number;
  publishedEnd?: number;
  dateCreatedStart?: number;
  dateCreatedEnd?: number;
  dataCoverageStart?: number;
  dataCoverageEnd?: number;
  creatorName?: string;
  contributorName?: string;
  ownerName?: string;
  fundingFunderName?: string;
  keyword?: string;
  creativeWorkStatus?: string[];
  contentType?: string[];
}

export interface ITypeaheadParams {
  term: string;
  field: EnumHistoryTypes
}

export enum EnumShortParams {
  QUERY = "q",
  AUTHOR_NAME = "an",
  CONTRIBUTOR_NAME = "cn",
  OWNER_NAME = "on",
  CONTENT_TYPE = "ct",
  FUNDER = "f",
  SUBJECT = "sj",
  AVAILABILITY = "a",
  CREATION_DATE = "cd",
  PUBLICATION_YEAR = "py",
  DATA_COVERAGE = "dc",
}

export enum EnumHistoryTypes {
  TERM = "term",
  CREATOR = "creator",
  CONTRIBUTOR = "contributor",
  SUBJECT = "subject",
  FUNDER = "funder",
  DATABASE = "db",
}

export type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U;
};
