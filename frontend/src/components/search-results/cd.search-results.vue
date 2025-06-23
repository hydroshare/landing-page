<template>
  <v-container
    class="cd-search-results text-body-1"
    :class="{ 'is-small': $vuetify.display.smAndDown }"
  >
    <div class="d-flex align-baseline">
      <div class="text-h5 font-weight-bold mr-2">Discover</div>
      <div class="text-medium-emphasis text-body-1 font-italic">
        Public resources shared with the community
      </div>
    </div>
    <v-divider class="mt-2 mb-6"></v-divider>
    <div class="d-sm-block d-md-flex">
      <v-container class="sidebar flex-shrink-0">
        <div class="sidebar--content">
          <div class="text-h6 mb-6">Filters</div>

          <v-expansion-panels multiple v-model="panels">
            <v-expansion-panel tile key="0">
              <v-expansion-panel-title class="py-0 px-4" color="grey-lighten-3">
                <v-switch
                  @click.stop=""
                  v-model="filter.availability.isActive"
                  @update:model-value="pushSearchRoute"
                  density="compact"
                  hide-details
                  color="primary"
                ></v-switch>
                <div class="ml-4 text-body-1 cursor-pointer">Availiability</div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <div
                  v-for="(option, index) of filter.availability.options"
                  class="d-flex justify-space-between align-center"
                >
                  <v-checkbox
                    v-model="filter.availability.value"
                    @update:model-value="
                      onFilterControlChange(filter.availability)
                    "
                    color="primary"
                    :label="option"
                    :key="index"
                    :value="option"
                    hide-details
                    density="compact"
                  ></v-checkbox>
                  <v-img
                    v-if="option === 'Public'"
                    :src="sharingStatusIcons.PUBLIC"
                    class="img-access-icon flex-grow-0"
                    width="25"
                    title="Public"
                    alt="Public"
                  />

                  <v-img
                    v-else-if="option === 'Published'"
                    :src="sharingStatusIcons.PUBLISHED"
                    class="img-access-icon flex-grow-0"
                    width="25"
                    title="Published"
                    alt="Published"
                  />

                  <v-img
                    v-else-if="option === 'Discoverable'"
                    :src="sharingStatusIcons.DISCOVERABLE"
                    class="img-access-icon flex-grow-0"
                    width="25"
                    title="Discoverable"
                    alt="Discoverable"
                  />
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel tile key="1">
              <v-expansion-panel-title class="py-0 px-4" color="grey-lighten-3">
                <v-switch
                  @click.stop=""
                  v-model="filter.contentType.isActive"
                  @update:model-value="pushSearchRoute"
                  density="compact"
                  hide-details
                  color="primary"
                ></v-switch>
                <div class="ml-4 text-body-1 cursor-pointer">Content type</div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <v-checkbox
                  v-for="(option, index) of filter.contentType.options"
                  v-model="filter.contentType.value"
                  @update:model-value="
                    onFilterControlChange(filter.contentType)
                  "
                  :label="option.label"
                  :key="index"
                  :value="option.value"
                  hide-details
                  density="compact"
                  color="primary"
                ></v-checkbox>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel tile key="2">
              <v-expansion-panel-title class="py-0 px-4" color="grey-lighten-4">
                <v-switch
                  @click.stop=""
                  v-model="filter.dataCoverage.isActive"
                  @update:model-value="pushSearchRoute"
                  density="compact"
                  hide-details
                  color="primary"
                ></v-switch>
                <div class="ml-4 text-body-1 cursor-pointer">
                  Temporal coverage
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <cd-range-input
                  v-model="dataCoverage"
                  v-model:isActive="filter.dataCoverage.isActive"
                  @update:is-active="pushSearchRoute"
                  @end="onFilterControlChange(filter.dataCoverage)"
                  :min="filter.dataCoverage.min"
                  :max="filter.dataCoverage.max"
                  label="Temporal coverage"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel tile key="3">
              <v-expansion-panel-title class="py-0 px-4" color="grey-lighten-4">
                <v-switch
                  @click.stop=""
                  v-model="filter.creationDate.isActive"
                  @update:model-value="pushSearchRoute"
                  density="compact"
                  hide-details
                  color="primary"
                ></v-switch>

                <div class="ml-4 text-body-1 cursor-pointer">Date created</div>
              </v-expansion-panel-title>

              <v-expansion-panel-text key="4">
                <!-- DATA COVERAGE -->
                <cd-range-input
                  v-model="creationDate"
                  v-model:isActive="filter.creationDate.isActive"
                  @update:is-active="pushSearchRoute"
                  @end="onFilterControlChange(filter.creationDate)"
                  :min="filter.creationDate.min"
                  :max="filter.creationDate.max"
                  label="Date created"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel tile>
              <v-expansion-panel-title class="py-0 px-4" color="grey-lighten-4">
                <v-switch
                  @click.stop=""
                  v-model="filter.publicationYear.isActive"
                  @update:model-value="pushSearchRoute"
                  density="compact"
                  hide-details
                  color="primary"
                ></v-switch>

                <div class="ml-4 text-body-1 cursor-pointer">
                  Publication year
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <!-- PUBLICATION YEAR -->
                <cd-range-input
                  v-model="publicationYear"
                  v-model:isActive="filter.publicationYear.isActive"
                  @update:is-active="pushSearchRoute"
                  @end="onFilterControlChange(filter.publicationYear)"
                  :min="filter.publicationYear.min"
                  :max="filter.publicationYear.max"
                  label="Publication year"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <!-- SUBJECT -->
          <v-text-field
            @blur="pushSearchRoute"
            @keyup.enter="pushSearchRoute"
            @click:clear="pushSearchRoute"
            v-model="filter.subject"
            label="Subject"
            class="mt-6"
            prepend-inner-icon="mdi-pen"
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />

          <!-- AUTHOR NAME -->
          <v-text-field
            @blur="pushSearchRoute"
            @keyup.enter="pushSearchRoute"
            @click:clear="pushSearchRoute"
            v-model="filter.creatorName"
            label="Author's name"
            class="mt-6"
            prepend-inner-icon="mdi-account-edit"
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />

          <!-- <v-text-field
            @blur="pushSearchRoute"
            @keyup.enter="pushSearchRoute"
            @click:clear="pushSearchRoute"
            v-model="filter.ownerName"
            label="Owner's name"
            class="mt-6"
            prepend-inner-icon="mdi-account-key"
            hide-details
            clearable
            variant="outlined"
            density="compact"
          /> -->

          <v-text-field
            @blur="pushSearchRoute"
            @keyup.enter="pushSearchRoute"
            @click:clear="pushSearchRoute"
            v-model="filter.contributorName"
            label="Contributor's name"
            class="mt-6"
            prepend-inner-icon="mdi-account-group"
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />

          <v-text-field
            @blur="pushSearchRoute"
            @keyup.enter="pushSearchRoute"
            @click:clear="pushSearchRoute"
            v-model="filter.fundingFunderName"
            label="Funder"
            class="mt-6"
            prepend-inner-icon="mdi-domain"
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />

          <v-btn
            :disabled="!isSomeFilterActive"
            @click="clearFilters"
            class="mt-4"
            block
            >Clear Filters</v-btn
          >

          <!-- <div class="text-center mt-8">
            <v-btn
              @click="clearFilters"
              :disabled="!isSomeFilterActive"
              variant="text"
              >Clear Filters</v-btn
            >
          </div> -->
        </div>
      </v-container>

      <div class="results-content-wrapper">
        <v-container class="results-content">
          <div class="d-flex align-center gap-1 mb-6">
            <cd-search
              v-model="searchQuery"
              @update:model-value="pushSearchRoute"
              @clear="
                searchQuery = '';
                pushSearchRoute();
              "
              :inputAttrs="{ variant: 'outlined' }"
            />
            <v-card
              v-if="isSomeFilterActive"
              density="compact"
              flat
              variant="outlined"
            >
              <v-card-text class="d-flex align-center py-2">
                <div class="text-body-2 mr-1">Active filters</div>
                <v-btn
                  @click="clearFilters"
                  variant="text"
                  density="compact"
                  icon="mdi-close"
                  size="small"
                  title="Clear filters"
                ></v-btn>
              </v-card-text>
            </v-card>
          </div>

          <div class="results-container mb-12">
            <template v-if="isSearching">
              <!-- TODO: refactor into a component -->
              <!-- <v-skeleton-loader type="list-item" width="150" /> -->
              <v-card elevation="2">
                <v-card-text>
                  <div v-for="index in 4" :key="index">
                    <v-skeleton-loader type="table-tbody" />
                  </div>
                </v-card-text>
              </v-card>
            </template>

            <template v-else>
              <v-card
                elevation="2"
                v-if="!results.length"
                class="text-body-2 text-center mt-8 py-12"
              >
                <v-card-text>
                  <v-empty-state
                    text="No results found."
                    icon="mdi-text-box-remove"
                  />
                </v-card-text>
              </v-card>

              <v-data-table-virtual
                v-if="results.length"
                :headers="headers.filter((header) => header.visible)"
                :items="results"
                class="elevation-2 text-body-1"
                hover
                expand-on-click
                show-expand
                density="compact"
              >
                <template v-slot:item.icons="{ item }">
                  <div class="d-flex align-center justify-start">
                    <v-img
                      class="img-content-type mr-2"
                      v-if="contentTypeLogos[item.contentType]"
                      :src="contentTypeLogos[item.contentType]"
                      :title="item.contentType"
                      width="60"
                      max-width="60"
                    />
                    <v-img
                      class="img-access-icon flex-grow-0"
                      width="25"
                      v-if="item.sharingStatus === 'Public'"
                      :src="sharingStatusIcons.PUBLIC"
                      title="Public"
                      alt="Public"
                    />
                    <v-img
                      class="img-access-icon flex-grow-0"
                      width="25"
                      v-else-if="item.sharingStatus === 'Private'"
                      :src="sharingStatusIcons.PRIVATE"
                      title="Private"
                      alt="Private"
                    />
                    <v-img
                      class="img-access-icon flex-grow-0"
                      width="25"
                      v-else-if="item.sharingStatus === 'Discoverable'"
                      :src="sharingStatusIcons.DISCOVERABLE"
                      title="Discoverable"
                      alt="Discoverable"
                    />
                    <v-img
                      class="img-access-icon flex-grow-0"
                      width="25"
                      v-if="item.sharingStatus === 'Published'"
                      :src="sharingStatusIcons.PUBLISHED"
                      title="Published"
                      alt="Published"
                    />
                    <v-img
                      class="img-access-icon flex-grow-0"
                      width="25"
                      v-if="hasSpatialFeatures(item)"
                      :src="sharingStatusIcons.SPATIAL"
                      title="Contains Spatial Coverage"
                      alt="Contains Spatial Coverage"
                    />
                  </div>
                </template>
                <template #item.title="{ item }">
                  <a
                    v-if="item.identifier"
                    class="text-decoration-none"
                    :href="item.identifier"
                    target="_blank"
                    v-html="highlight(item, 'name')"
                  ></a>
                  <p v-else v-html="highlight(item, 'name')"></p>
                </template>
                <template #item.firstAuthor="{ item }">
                  <div v-html="highlightCreators(item)"></div>
                </template>
                <template #item.dateCreated="{ item }">
                  <span v-if="item.dateCreated">{{
                    formatDate(item.dateCreated)
                  }}</span>
                </template>
                <template #item.lastModified="{ item }">
                  <span v-if="item.lastModified">{{
                    formatDate(item.lastModified)
                  }}</span>
                </template>
                <template #expanded-row="{ item }">
                  <div class="d-table-row">
                    <td class="d-table-cell" colspan="6">
                      <v-card class="mx-4" flat>
                        <v-card-text>
                          <div class="d-flex gap-2">
                            <div class="flex-grow-1">
                              <div class="text-h6">Subject Keywords</div>
                              <div>
                                <v-chip
                                  v-for="keyword of item.keywords"
                                  size="small"
                                  style="margin: 0.25rem"
                                  >{{ keyword }}</v-chip
                                >
                              </div>
                              <div class="text-h6 mt-4">Abstract</div>
                              <p
                                :class="{ 'snip-3': !item._showMore }"
                                v-html="highlight(item, 'description')"
                              ></p>

                              <v-btn
                                size="x-small"
                                variant="text"
                                color="primary"
                                @click="item._showMore = !item._showMore"
                                >Show
                                {{ item._showMore ? "less" : "more" }}...</v-btn
                              >
                            </div>

                            <div v-if="hasSpatialFeatures(item)">
                              <div class="text-h6">Spatial Coverage</div>

                              <div :id="`map-${item.id}`" class="mb-4">
                                <cd-spatial-coverage-map
                                  :loader="loader"
                                  :loader-options="options"
                                  :feature="item.spatialCoverage"
                                />
                              </div>
                            </div>
                          </div>
                        </v-card-text>
                      </v-card>
                      <v-divider></v-divider>
                    </td>
                  </div>
                </template>

                <!-- <div class="my-1" v-if="result.datePublished">
                  Publication Date: {{ formatDate(result.datePublished) }}
                </div> -->
              </v-data-table-virtual>
            </template>
          </div>

          <div
            v-if="results.length"
            v-intersect="{
              handler: onIntersect,
              options: { threshold: [0, 0.5, 1.0] },
            }"
          ></div>
          <div v-if="isFetchingMore" class="text-subtitle-2 text-center">
            Loading more results...
          </div>
          <div
            v-if="results.length && !hasMore"
            class="text-subtitle-2 text-center"
          >
            End of results.
          </div>
        </v-container>
      </div>
    </div>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
import { MIN_YEAR, MAX_YEAR } from "@/constants";
import { sameRouteNavigationErrorHandler } from "@/constants";
import { Loader, LoaderOptions } from "google-maps";
import { formatDate } from "@/util";
import CdSpatialCoverageMap from "@/components/search-results/cd.spatial-coverage-map.vue";
import CdSearch from "@/components/search/cd.search.vue";
import SearchResults from "@/models/search-results.model";
import SearchHistory from "@/models/search-history.model";
import Search from "@/models/search.model";
import { Notifications } from "@cznethub/cznet-vue-core";
import {
  ISearchFilter,
  ISearchParams,
  IResult,
  EnumShortParams,
  EnumDictionary,
} from "@/types";
import CdRangeInput from "./cd.range-input.vue";
import { useRoute, useRouter } from "vue-router";

const options: LoaderOptions = { libraries: ["drawing"] };
const loader: Loader = new Loader(
  import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY,
  options,
);

const contentTypeLogos: { [key: string]: string } = {
  CompositeResource: new URL("/img/composite48x48.png", import.meta.url).href,
  CollectionResource: new URL("/img/collection48x48.png", import.meta.url).href,
  GeographicRasterAggregation: new URL(
    "/img/geographicraster48x48.png",
    import.meta.url,
  ).href,
  TimeSeriesAggregation: new URL("/img/timeseries48x48.png", import.meta.url)
    .href,
  GeographicFeatureAggregation: new URL(
    "/img/geographicfeature48x48.png",
    import.meta.url,
  ).href,
  MultidimensionalAggregation: new URL(
    "/img/multidimensional48x48.png",
    import.meta.url,
  ).href,
};

const sharingStatusIcons: { [key: string]: string } = {
  PUBLIC: new URL("/img/public.png", import.meta.url).href,
  PRIVATE: new URL("/img/private.png", import.meta.url).href,
  DISCOVERABLE: new URL("/img/discoverable.png", import.meta.url).href,
  PUBLISHED: new URL("/img/published.png", import.meta.url).href,
  SPATIAL: new URL("/img/Globe-Green.png", import.meta.url).href,
};

@Component({
  name: "cd-search-results",
  components: { CdSearch, CdSpatialCoverageMap, CdRangeInput },
})
class CdSearchResults extends Vue {
  loader = loader;
  options = options;
  isIntersecting = false;
  searchQuery = "";
  pageNumber = 1;
  pageSize = 20;
  hasMore = true;
  isSearching = false;
  isFetchingMore = false;
  // public view: 'list' | 'map' = 'list'

  filter: ISearchFilter = {
    publicationYear: {
      min: MIN_YEAR,
      max: MAX_YEAR,
      isActive: false,
    },
    creationDate: {
      min: MIN_YEAR,
      max: MAX_YEAR,
      isActive: false,
    },
    dataCoverage: {
      min: MIN_YEAR,
      max: MAX_YEAR,
      isActive: false,
    },
    contentType: {
      options: [
        // TODO: get the 'value' prop values
        { label: "Composite Resource", value: "CompositeResource" },
        { label: "Collection", value: "CollectionResource" },
        { label: "Time Series", value: "TimeSeriesAggregation" },
        { label: "CSV Data", value: "CSV Data" },
        { label: "Document", value: "Document" },
        { label: "File Set", value: "File Set" },
        { label: "Generic Data", value: "Generic Data" },
        {
          label: "Geographic Feature (ESRI Shapefiles)",
          value: "GeographicFeatureAggregation",
        },
        { label: "Geographic Raster", value: "GeographicRasterAggregation" },
        {
          label: "Multidimensional (NetCDF)",
          value: "MultidimensionalAggregation",
        },
        { label: "Image", value: "Image" },
      ],
      value: null,
      isActive: false,
    },

    availability: {
      options: ["Discoverable", "Public", "Published"],
      value: null,
      isActive: false,
    },
    creatorName: "",
    contributorName: "",
    ownerName: "",
    subject: "",
    fundingFunderName: "",
  };

  availabilityIcons = [
    { icon: "mdi-lock-open", size: "small", color: "orange-darken-2" }, // Discoverable
    { icon: "mdi-lock", size: "small", color: "green-darken-2" }, // Public
    { icon: "mdi-feather", class: "pl-1", color: "green-darken-2" }, // Published
  ];
  contentTypeLogos = contentTypeLogos;
  sharingStatusIcons = sharingStatusIcons;

  headers = reactive([
    {
      title: "",
      key: "icons",
      visible: true,
      width: 60,
      minWidth: 60,
      sortable: false,
    },
    {
      title: "Title",
      key: "title",
      visible: true,
      minWidth: 200,
      sortable: false,
    },
    {
      title: "First Author",
      key: "firstAuthor",
      visible: true,
      minWidth: 200,
      sortable: false,
    },
    {
      title: "Date Created",
      key: "dateCreated",
      visible: true,
      minWidth: 200,
      sortable: false,
    },
    {
      title: "Last Modified",
      key: "lastModified",
      visible: true,
      minWidth: 200,
      sortable: false,
    },
  ]);

  formatDate = formatDate;
  route = useRoute();
  router = useRouter();

  public get creationDate() {
    return SearchResults.$state.creationDate;
  }

  public set creationDate(range: [number, number]) {
    // TODO: validate input
    SearchResults.commit((state) => {
      state.creationDate = range;
    });
  }

  public get publicationYear() {
    return SearchResults.$state.publicationYear;
  }

  public set publicationYear(range: [number, number]) {
    // TODO: validate input
    SearchResults.commit((state) => {
      state.publicationYear = range;
    });
  }

  public get dataCoverage() {
    return SearchResults.$state.dataCoverage;
  }

  public set dataCoverage(range: [number, number]) {
    // TODO: validate input
    SearchResults.commit((state) => {
      state.dataCoverage = range;
    });
  }

  public get panels() {
    return SearchResults.$state.panels;
  }

  public set panels(range: number[]) {
    // TODO: validate input
    SearchResults.commit((state) => {
      state.panels = range;
    });
  }

  public get results(): IResult[] {
    return Search.$state.results;
  }

  // public get clusters() {
  //   return Search.$state.clusters;
  // }

  public get isSomeFilterActive() {
    return (
      this.filter.creationDate.isActive ||
      this.filter.publicationYear.isActive ||
      this.filter.dataCoverage.isActive ||
      (this.filter.availability.isActive &&
        this.filter.availability.value?.length) ||
      (this.filter.contentType.isActive &&
        this.filter.contentType.value?.length) ||
      this.filter.creatorName ||
      this.filter.contributorName ||
      this.filter.ownerName ||
      this.filter.subject ||
      this.filter.fundingFunderName
    );
  }

  /** Search query parameters */
  get queryParams(): ISearchParams {
    const queryParams: ISearchParams = {
      term: this.searchQuery,
      pageSize: this.pageSize,
      pageNumber: this.pageNumber,
    };

    // CREATION DATE
    if (this.filter.creationDate.isActive) {
      queryParams.dateCreatedStart = this.creationDate[0];
      queryParams.dateCreatedEnd = this.creationDate[1];
    }

    // PUBLICATION YEAR
    if (this.filter.publicationYear.isActive) {
      queryParams.publishedStart = this.publicationYear[0];
      queryParams.publishedEnd = this.publicationYear[1];
    }

    // DATA COVERAGE
    if (this.filter.dataCoverage.isActive) {
      queryParams.dataCoverageStart = this.dataCoverage[0];
      queryParams.dataCoverageEnd = this.dataCoverage[1];
    }

    // CREATOR NAME
    if (this.filter.creatorName) {
      queryParams.creatorName = this.filter.creatorName;
    }

    if (this.filter.contributorName) {
      queryParams.contributorName = this.filter.contributorName;
    }

    if (this.filter.ownerName) {
      queryParams.ownerName = this.filter.ownerName;
    }

    if (this.filter.fundingFunderName) {
      queryParams.fundingFunderName = this.filter.fundingFunderName;
    }

    if (this.filter.subject) {
      queryParams.keyword = this.filter.subject;
    }

    // AVAILABILITY
    if (this.filter.availability.isActive && this.filter.availability.value) {
      queryParams.creativeWorkStatus = this.filter.availability.value;
    }

    // CONTENT TYPE
    if (
      this.filter.contentType.isActive &&
      this.filter.contentType.value?.length
    ) {
      queryParams.contentType = this.filter.contentType.value;
    }

    return queryParams;
  }

  /** Route query parameters with short keys. These are parameters needed to replicate a search. */
  public get routeParams(): EnumDictionary<EnumShortParams, any> {
    return {
      [EnumShortParams.QUERY]: this.searchQuery,
      [EnumShortParams.AUTHOR_NAME]: this.filter.creatorName || undefined,
      [EnumShortParams.CONTRIBUTOR_NAME]:
        this.filter.contributorName || undefined,
      [EnumShortParams.OWNER_NAME]: this.filter.ownerName || undefined,
      [EnumShortParams.FUNDER]: this.filter.fundingFunderName || undefined,
      [EnumShortParams.SUBJECT]: this.filter.subject || undefined,
      [EnumShortParams.AVAILABILITY]: this.filter.availability.isActive
        ? this.filter.availability.value || undefined
        : undefined,
      [EnumShortParams.CONTENT_TYPE]: this.filter.contentType.isActive
        ? this.filter.contentType.value || undefined
        : undefined,
      [EnumShortParams.CREATION_DATE]: this.filter.creationDate.isActive
        ? this.creationDate.map((n) => n.toString()) || undefined
        : undefined,
      [EnumShortParams.PUBLICATION_YEAR]: this.filter.publicationYear.isActive
        ? this.publicationYear.map((n) => n.toString()) || undefined
        : undefined,
      [EnumShortParams.DATA_COVERAGE]: this.filter.dataCoverage.isActive
        ? this.dataCoverage.map((n) => n.toString()) || undefined
        : undefined,
    };
  }

  created() {
    this._loadRouteParams();
    this._onSearch();
  }

  public onIntersect(_isIntersecting: boolean, entries: any[], _observer: any) {
    this.isIntersecting = entries[0]?.intersectionRatio >= 0.5;
    if (
      this.isIntersecting &&
      this.results.length &&
      this.hasMore &&
      !this.isSearching &&
      !this.isFetchingMore
    ) {
      this.fetchMore();
    }
  }

  /** Pushes the desired search to the router, which will reload the route with the new query parameters */
  pushSearchRoute() {
    try {
      if (this.queryParams.term) {
        SearchHistory.log(this.queryParams.term);
      }

      // This will reload the component because the router-view in the App component has `:key="route.fullPath"`
      this.router
        .push({
          name: "search",
          query: this.routeParams,
        })
        .catch(sameRouteNavigationErrorHandler);
    } catch (e) {
      console.log(e);
      Search.commit((state) => {
        state.results = [];
      });
      Notifications.toast({
        message: `Failed to perform search`,
        type: "error",
      });
    }
  }

  async _onSearch() {
    this.hasMore = true;
    this.isSearching = true;
    this.pageNumber = 1;

    this.hasMore = !!(await Search.search(this.queryParams));
    this.isSearching = false;
  }

  /** Get the next page of results. */
  public async fetchMore() {
    this.pageNumber++;
    this.isFetchingMore = true;
    try {
      this.hasMore = await Search.fetchMore(this.queryParams);
    } catch (e) {
      console.log(e);
    }
    this.isFetchingMore = false;
  }

  public onFilterControlChange(
    filter: Partial<{
      isActive: boolean;
    }>,
  ) {
    filter.isActive = true;

    this.pushSearchRoute();
  }

  public highlightCreators(result: IResult) {
    if (!result.creator) {
      return "";
    }
    const div = document.createElement("DIV");
    // div.innerHTML = result.creator.join(", ");
    div.innerHTML = result.creator[0] || "";

    let content = div.textContent || div.innerText || "";

    if (result.highlights) {
      let hits = result.highlights
        .filter((highlight) => highlight.path === "creator.@list.name")
        .map((hit) =>
          hit.texts.filter((t) => t.type === "hit").map((t) => t.value),
        )
        .flat();

      hits = [...new Set(hits)];
      hits.map((hit) => {
        content = content.replaceAll(hit, `<mark>${hit}</mark>`);
      });
    }
    return content;
  }

  /** Applies highlights to a string or string[] field and returns the new content as HTML */
  public highlight(result: IResult, path: keyof IResult) {
    const div = document.createElement("DIV");
    const field = result[path];

    div.innerHTML = Array.isArray(field) ? field.join(", ") : field;
    let content = div.textContent || div.innerText || "";

    if (result.highlights) {
      let hits = result.highlights
        .filter((highlight) => highlight.path === path)
        .map((hit) =>
          hit.texts.filter((t) => t.type === "hit").map((t) => t.value),
        )
        .flat();

      hits = [...new Set(hits)];
      hits.map((hit) => {
        content = content.replaceAll(hit, `<mark>${hit}</mark>`);
      });
    }

    return content;
  }

  public clearFilters() {
    const wasSomeActive = this.isSomeFilterActive;

    this.filter.creationDate.isActive = false;
    this.creationDate = [MIN_YEAR, MAX_YEAR];

    this.filter.publicationYear.isActive = false;
    this.publicationYear = [MIN_YEAR, MAX_YEAR];

    this.filter.dataCoverage.isActive = false;
    this.dataCoverage = [MIN_YEAR, MAX_YEAR];

    this.filter.availability.value = null;
    this.filter.availability.isActive = false;

    this.filter.contentType.value = null;
    this.filter.contentType.isActive = false;

    this.filter.creatorName = "";
    this.filter.contributorName = "";
    this.filter.ownerName = "";
    this.filter.subject = "";
    this.filter.fundingFunderName = "";

    if (wasSomeActive) {
      this.pushSearchRoute();
    }
  }

  /** Load route query parameters into component values. */
  private _loadRouteParams() {
    // SEARCH QUERY
    this.searchQuery = this.$route.query[EnumShortParams.QUERY] as string;

    this.filter.creatorName =
      (this.$route.query[EnumShortParams.AUTHOR_NAME] as string) || "";
    this.filter.contributorName =
      (this.$route.query[EnumShortParams.CONTRIBUTOR_NAME] as string) || "";
    this.filter.ownerName =
      (this.$route.query[EnumShortParams.OWNER_NAME] as string) || "";
    this.filter.fundingFunderName =
      (this.$route.query[EnumShortParams.FUNDER] as string) || "";
    this.filter.subject =
      (this.$route.query[EnumShortParams.SUBJECT] as string) || "";

    // CONTENT TYPE
    if (this.$route.query[EnumShortParams.CONTENT_TYPE]) {
      this.filter.contentType.isActive = true;
      this.filter.contentType.value = this.$route.query[
        EnumShortParams.CONTENT_TYPE
      ]
        ? ([this.$route.query[EnumShortParams.CONTENT_TYPE]].flat() as string[])
        : null;
    }

    // AVAILABILITY
    if (this.$route.query[EnumShortParams.AVAILABILITY]) {
      this.filter.availability.isActive = true;
      this.filter.availability.value = this.$route.query[
        EnumShortParams.AVAILABILITY
      ]
        ? ([this.$route.query[EnumShortParams.AVAILABILITY]].flat() as string[])
        : null;
    }

    // CREATION DATE
    if (this.$route.query[EnumShortParams.CREATION_DATE]) {
      this.filter.creationDate.isActive = true;
      this.creationDate =
        ((
          this.$route.query[EnumShortParams.CREATION_DATE] as [string, string]
        )?.map((n) => +n) as [number, number]) || this.creationDate;
    }

    // PUBLICATION YEAR
    if (this.$route.query[EnumShortParams.PUBLICATION_YEAR]) {
      this.filter.publicationYear.isActive = true;
      this.publicationYear =
        ((
          this.$route.query[EnumShortParams.PUBLICATION_YEAR] as [
            string,
            string,
          ]
        )?.map((n) => +n) as [number, number]) || this.publicationYear;
    }

    // DATA COVERAGE
    if (this.$route.query[EnumShortParams.DATA_COVERAGE]) {
      this.filter.dataCoverage.isActive = true;
      this.dataCoverage =
        ((
          this.$route.query[EnumShortParams.DATA_COVERAGE] as [string, string]
        )?.map((n) => +n) as [number, number]) || this.dataCoverage;
    }
  }

  public hasSpatialFeatures(result: IResult): boolean {
    return result.spatialCoverage;
  }
}
export default toNative(CdSearchResults);
</script>

<style lang="scss" scoped>
.v-expansion-panel--active,
.v-expansion-panel--active:not(:first-child),
.v-expansion-panel--active + .v-expansion-panel {
  margin-top: 1px;
}

:deep(.v-table .v-data-table__tr:nth-child(even) td) {
  background: #f7f7f7;
}

:deep(.v-table tr.v-data-table__tr td) {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.sidebar {
  width: 20rem;
}

.cd-search-results.is-small {
  .sidebar {
    width: 100%;
  }
}

.results-content-wrapper {
  flex: 1 1 auto;
}

.img-content-type {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 3px;
}

// .results-content {
//   min-width: 0; // https://stackoverflow.com/a/66689926/3288102
//   max-width: 70rem;
//   margin: unset;
// }

.results-container {
  * {
    word-break: break-word;
  }

  a {
    text-decoration: none;
    &:hover {
      text-decoration: underline !important;
    }
  }
}

.grayed-out {
  opacity: 0.55;
}

:deep(.v-select--chips .v-select__selections .v-chip--select:first-child) {
  margin-top: 1rem;
}
</style>
