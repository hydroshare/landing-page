<template>
  <v-card id="app-geoconnex" variant="outlined" border="grey thin" class="pa-4">
    <p class="mb-4">
      <i>This HydroShare resource is linked to the following geospatial features</i>
      <v-tooltip v-if="resMode=='Edit'" location="top">
        <template v-slot:activator="{ props }">
          <v-icon v-bind="props" size="small" class="ml-1 text-grey">mdi-information-outline</v-icon>
        </template>
        <span>Use this section to add persistent identifiers pointing at related geospatial features.</span>
      </v-tooltip>
    </p>
    
    <div id="geoconnex-message-wrapper" v-if="resMode=='Edit'">
      <v-alert type="info" variant="tonal" dismissible class="mb-3">
        <div class="d-flex align-center">
          <em class="text-body-2">
            <strong><a href="https://geoconnex.internetofwater.dev/" target="_blank" class="text-info">Geoconnex</a>, through the <a href="https://internetofwater.org/" target="_blank" class="text-info">Internet of Water</a>:</strong>
            This field allows you to relate this resource to overlapping geospatial features
            in order to increase the <strong><a href="https://www.go-fair.org/fair-principles/" target="_blank" class="text-info">FAIR</a></strong>ness and discoverability of your data.
            Below, collections of reference features within the United States are provided.
            Search these collections to find features that overlap with your data, or provide a URL that resolves to a geospatial feature not yet in the Geoconnex collections.
            <br>
            <strong>
              <a target="_blank"
                href="https://help.hydroshare.org/publishing-in-hydroshare/metadata-best-practices/related-geospatial-features"
                class="text-info">
                Learn more about Related Geospatial Features
              </a>
            </strong>
          </em>
        </div>
      </v-alert>
      
      <v-alert v-if="!isLoading && !resSpatialType && resMode=='Edit'" type="warning" variant="tonal" dismissible class="mb-2">
        <p class="mb-0">We highly recommend that you add Spatial Coverage to this resource before searching for related geospatial features. Otherwise query times can be excessive.</p>
      </v-alert>
      
      <v-alert v-if="resSpatialExtentArea > largeExtentWarningThreshold" type="warning" variant="tonal" dismissible class="mb-2">
        <div class="d-flex align-center">
          <v-icon class="mr-2">mdi-information</v-icon>
          <em class="text-body-2">
            Please note: your resource spatial extent ({{(resSpatialExtentArea * 1e-6).toFixed(0)}} square kilometers) is larger than a big US state.
            You might experience reduced performance during your searches.
          </em>
        </div>
      </v-alert>
      
      <v-alert v-if="searchResultString" type="warning" variant="tonal" class="mb-2">
        <em class="text-body-2">{{ searchResultString }}</em>
      </v-alert>
      
      <v-alert v-for="messageObj in appMessages" :key="messageObj.message" :type="messageObj.level" variant="tonal" dismissible class="mb-2">
        <div class="d-flex align-center">
          <v-icon class="mr-2">mdi-information</v-icon>
          <em class="text-body-2">{{ messageObj.message }}</em>
        </div>
      </v-alert>
    </div>
    
    <div class="row">
      <div v-if="resMode === 'Edit'" class="col-xs-12" :class="{'col-lg-4': showingMap}" id="geoconnex-controls-wrapper">
        <v-autocomplete
          :menu-props="{closeOnClick: true, closeOnContentClick: true}"
          :readonly="lockCollectionsInput"
          v-model="collectionsSelectedToSearch"
          :items="collections"
          :item-title="item => `${item.description} (${item.id})`"
          :hide-no-data="!collectionTypeahead"
          multiple
          placeholder="Type to narrow down options or select from the list"
          :label="limitToSingleCollection ? '1. Choose a collection to search...' : '1. Choose collections to search...'"
          :disabled="loadingCollections || searchingDescription !==''"
          :loading="loadingCollections || searchingDescription !==''"
          variant="outlined"
          hide-details
          :color="collectionColor"
          :item-color="collectionColor"
          @update:search="collectionTypeahead = $event"
          :error="searchResultString !==''"
          :return-object="true"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props">
              <template>
                <v-list-item-title>{{ item }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.id }}</v-list-item-subtitle>
              </template>
            </v-list-item>
          </template>
          
          <template v-slot:no-data>
            <v-list-item>
              <v-list-item-title>
                No collections matching "<strong>{{ collectionTypeahead }}</strong>".
              </v-list-item-title>
            </v-list-item>
          </template>
          
          <template v-slot:selection="{ item, parent }">
            <div v-if="limitToSingleCollection">
              {{ item.raw.description }} ({{ item.raw.id }})
            </div>
            <v-chip v-else label variant="outlined" size="large">
              <span class="text-truncate">
                {{ item.raw.description }} ({{ item.raw.id }})
              </span>
              <v-icon 
                v-show="!loadingCollections && searchingDescription==''" 
                @click.stop="parent.selectItem(item)" 
                size="small"
                class="ml-1"
              >mdi-close-circle</v-icon>
            </v-chip>
          </template>
          
          <template v-if="limitToSingleCollection && hasSearches" v-slot:append-inner>
            <v-slide-x-reverse-transition mode="out-in">
              <v-icon
                :key="`icon-${hasSearches}`"
                v-show="!loadingCollections && searchingDescription==''"
                @click="clearMapOfSearches" 
                class="mdi mdi-close-circle text-grey"
                size="small"
              ></v-icon>
            </v-slide-x-reverse-transition>
          </template>
        </v-autocomplete>

        <div v-if="!isLoading" class="small text-muted mt-2 my-4">
          <!-- Feature options limited message -->
          <div v-if="hasSearchesWithouIssues" class="d-flex align-center mb-1">
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="mr-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Feature options for step #2 have been limited to the collection {{ collectionsSelectedToSearch.length > 1 ? 's' : '' }} you selected here.</span>
            </v-tooltip>
            <span class="text-caption">Feature options for step #2 have been limited to the collection {{ collectionsSelectedToSearch.length > 1 ? "s" : "" }} you selected here</span>
          </div>
          
          <!-- Loading Geoconnex relations message -->
          <div v-if="loadingCollections" class="d-flex align-center mb-1">
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="mr-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Loading Geoconnex relations</span>
            </v-tooltip>
            <span class="text-caption">Loading Geoconnex relations...</span>
          </div>
          
          <!-- Searching Geoconnex message -->
          <div v-if="searchingDescription" class="d-flex align-center mb-1">
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="mr-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Searching Geoconnex</span>
            </v-tooltip>
            <span class="text-caption"><b>Searching Geoconnex collection:</b> {{ searchingDescription }}</span>
          </div>
          
          <!-- Collection messages -->
          <div v-for="message in collectionMessages" :key="message" class="d-flex align-center mb-1">
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="mr-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>{{ message }}</span>
            </v-tooltip>
            <span class="text-caption">{{ message }}</span>
          </div>
        </div>

        <v-combobox
          v-model="selectedReferenceFeatures"
          class="mt-8"
          :class="{
            'col-xs-12 col-md-8': resMode === 'View', 
            'col-xs-12': resMode === 'Edit',
            'opaque': !hasSearches && selectedReferenceFeatures.length === 0
          }" 
          :items="features"
          :item-title="item => item.NAME"
          hide-no-data
          allow-overflow="false"
          chips
          closable-chips
          multiple
          variant="outlined"
          hide-selected
          :hide-no-data="!itemTypeahead"
          label="2. Select related features to add to resource metadata"
          placeholder="Type to narrow down options or select on the map"
          :disabled="searchingDescription !==''"
          :loading="loadingRelations"
          :search-input.sync="itemTypeahead"
          :rules="featureRules"
          :return-object="true"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props">
              <v-list-item-subtitle>{{ item.raw.relative_id }}</v-list-item-subtitle>
            </v-list-item>
          </template>
          
          <template v-slot:no-data>
            <v-list-item>
              <v-list-item-title>
                No results matching "<strong>{{ itemTypeahead }}</strong>". 
                Press <kbd>enter</kbd> to add <v-chip variant="outlined" size="small"><strong>{{ itemTypeahead }}</strong></v-chip> as a custom item.
              </v-list-item-title>
            </v-list-item>
          </template>
          
          <template v-slot:chip="{ props, item }">
            <v-chip v-bind="props">
              <span class="text-truncate" :title="item.raw.text.length > stringLengthLimit ? item.raw.text : ''">
                {{ item.raw.text }}
              </span>
            </v-chip>
          </template>
          
          <template v-slot:message="rulesMessage">
            <div v-if="rulesMessage.message" :style="`color: ${featureMessageColor}; margin-left: -12px;`" class="d-flex align-center mt-1">
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-icon v-bind="props" size="small" :color="featureMessageColor" class="mr-1">mdi-information-outline</v-icon>
                </template>
                <span>{{ rulesMessage.message }}</span>
              </v-tooltip>
              <span class="text-caption">{{ rulesMessage.message }}</span>
            </div>
          </template>
        </v-combobox>
      </div>
      
      <div v-else class="col-xs-12 col-lg-4 info-table-wrapper" v-if="searchingDescription =='' && selectedReferenceFeatures.length > 0">
        <v-table class="info-table" density="compact">
          <tbody>
            <tr v-for="value in selectedReferenceFeatures" :key="value.id || value.value" style="padding-bottom: 20px">
              <td v-if="isUrl(value.value)" class="dataset-details">
                <a target="_blank" :href="value.value" class="text-decoration-none text-primary">{{value.text}}</a>
                <v-icon size="small" class="ml-1">mdi-open-in-new</v-icon>
              </td>
              <td v-else class="dataset-details">{{value.text}}</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div 
        id="geoconnex-map-wrapper"
        class="col-xs-12 col-lg-8"
        :class="{
          'opaque': !hasSearches && selectedReferenceFeatures.length === 0
        }"
      >
        <div v-if="resMode === 'Edit'" id="geoconnex-controls" class="d-flex flex-wrap gap-2 mb-2">
          <!-- Show Map button (when map is hidden) -->
          <div v-if="!showingMap">
            <v-btn 
              :loading="isInitializingMap"
              @click="toggleMapVisibility" 
              variant="outlined" 
              size="small"
              color="grey"
              prepend-icon="mdi-earth"
              :disabled="isInitializingMap"
            >
              Select With Map
            </v-btn>
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="ml-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Shows additional map that you can use to query and view related geospatial features</span>
            </v-tooltip>
          </div>
          
          <!-- Hide Map button (when map is showing) -->
          <div v-if="showingMap">
            <v-btn @click="toggleMapVisibility" variant="outlined" size="small" color="grey" prepend-icon="mdi-minus">
              Hide Map
            </v-btn>
          </div>
          
          <!-- Search using visible map bounds button -->
          <div v-if="showingMap && hasSearches && searchingDescription ==''">
            <v-btn 
              @click="searchForFeaturesUsingVisibleMapBounds" 
              variant="tonal" 
              size="small"
              color="info"
              prepend-icon="mdi-magnify"
            >
              Search using visible map bounds
            </v-btn>
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="ml-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Search within the visible boundaries of the map, instead of using spatial extent. Zooming in will reduce the search area.</span>
            </v-tooltip>
          </div>
          
          <!-- Clear Search button -->
          <div v-if="!limitToSingleCollection && hasSearches && searchingDescription ==''">
            <v-btn 
              @click="clearMapOfSearches" 
              variant="tonal" 
              size="small"
              color="info"
              prepend-icon="mdi-magnify-minus"
            >
              Clear Search
            </v-btn>
            <v-tooltip location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" size="small" class="ml-1 text-grey">mdi-information-outline</v-icon>
              </template>
              <span>Clear unselected spatial features</span>
            </v-tooltip>
          </div>
        </div>
        
        <v-progress-linear
          v-show="showingMap"
          :active="true"
          v-if="searchingDescription !==''"
          indeterminate
          :color="collectionSearchColor"
          class="mb-2"
        ></v-progress-linear>
        
        <div v-if="showingMap" id="geoconnex-leaflet"></div>
        
        <div v-if="resMode === 'Edit' && showingMap" id="geoconnex-leaflet-info" class="text-caption text-grey mt-2">
          <p v-if="searchResultString">Click a point to search for features that overlap with that location.</p>
          <p v-if="features.length > 0">Select a feature for more information.</p>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script lang="ts">
// Recommend subscribing to notifications for PRs to https://github.com/internetofwater/geoconnex.us/
const limitNumberOfFeaturesPerRequest = 1000;
const geoconnexAppVerbose = true; // set true to increase console verbosity
const geoconnexBaseURLQueryParam = `items?f=json&limit=${limitNumberOfFeaturesPerRequest}`;
import { Component, Vue, toNative, Prop, Watch } from "vue-facing-decorator";
import L from "leaflet";
import "leaflet.fullscreen";
import area from '@turf/area';

@Component({
  name: "geoconnex",
  components: {},
})
class GeoConnex extends Vue {
  @Prop({ type: Object, required: true, default: () => ({}) })
  jsonData!: any;

  @Prop({ type: String, required: false, default: "View" })
  resMode!: string;

  @Watch("collectionsSelectedToSearch")
  async onCollectionsSelectedToSearchChange(newValue, oldValue) {
    const GeoConnexComponent = this;
      const oldLength = oldValue ? oldValue.length : 0;
      const newLength = newValue ? newValue.length : 0;

      if (GeoConnexComponent.limitToSingleCollection) {
        newLength == 1 && (GeoConnexComponent.lockCollectionsInput = true);
        newLength == 0 && (GeoConnexComponent.lockCollectionsInput = false);
      }
      GeoConnexComponent.searchResultString = "";
      GeoConnexComponent.map.closePopup();

      if (newLength > oldLength) {
        GeoConnexComponent.hasSearches = true;
        const newCollection = newValue.at(-1);
        if (GeoConnexComponent.resSpatialType) {
          GeoConnexComponent.updateAppWithResSpatialExtent();
          GeoConnexComponent.fetchGeoconnexFeaturesInBbox({
            bbox: GeoConnexComponent.bbox,
            collections: [newCollection],
          });
        } else {
          GeoConnexComponent.searchingDescription = newCollection.description;
          const featureCount =
            await GeoConnexComponent.countFeaturesFromSingleCollectionInBbox({
              collection: newCollection,
              bbox: null,
            });
          if (featureCount >= limitNumberOfFeaturesPerRequest) {
            GeoConnexComponent.searchResultString = `Your search in ${newCollection.id} returned too many features.
            The limit is ${limitNumberOfFeaturesPerRequest} so no geometries were mapped.
            We recommend that you refine resource extent, conduct a point search by clicking on the map, or search using map bounds.`;
            GeoConnexComponent.searchingDescription = "";
            return;
          }
          const featureCollection =
            await GeoConnexComponent.fetchFeaturesInCollection({
              collection: newCollection,
              forceFresh: false,
              skipGeometry: false,
            });
          if (featureCollection.features) {
            GeoConnexComponent.addSearchFeaturesToMap(
              featureCollection.features,
              featureCollection.collection
            );
          } else {
            GeoConnexComponent.searchResultString = `Your search in ${newCollection.description} didn't return any features.`;
          }
          GeoConnexComponent.searchingDescription = "";
        }
      } else if (newLength < oldLength) {
        let remove;
        if (newLength) {
          remove = oldValue.filter((obj) =>
            newValue.every((s) => s.id !== obj.id)
          );
        } else {
          remove = oldValue;
          GeoConnexComponent.hasSearches = false;
        }

        if (newLength) {
          for (const collection of remove) {
            GeoConnexComponent.searchFeatureGroup.removeLayer(
              GeoConnexComponent.searchLayerGroupDictionary[collection.id]
            );
            GeoConnexComponent.searchLayerGroupDictionary[
              collection.id
            ].clearLayers();

            GeoConnexComponent.layerControl.removeLayer(
              GeoConnexComponent.searchLayerGroupDictionary[collection.id]
            );
          }
        } else {
          GeoConnexComponent.clearMapOfSearches();
        }
        GeoConnexComponent.fitMapToFeatures();

        for (const collection of remove) {
          GeoConnexComponent.features = GeoConnexComponent.features.filter((item) => {
            return collection.id !== item.collection;
          });
        }
      }
  }

  @Watch("selectedReferenceFeatures")
  onSelectedReferenceFeaturesChange(newValue, oldValue) {
    const geoconnexComponent = this;
    const oldLength = oldValue ? oldValue.length : 0;
    const newLength = newValue ? newValue.length : 0;
    if (newLength > oldLength) {
      geoconnexComponent.addSelectedFeatureToResMetadata(newValue.pop());
    } else if (newLength < oldLength) {
      const remove = oldValue.filter((obj) =>
        newValue.every((s) => s.id !== obj.id)
      );

      geoconnexComponent.removeFeatureFromResMetadata(remove);
      if (!this.isGeoconnexUrl(remove[0].value)) return;

      try {
        geoconnexComponent.selectedFeatureGroup.removeLayer(
          geoconnexComponent.selectedLayerDictionary[remove[0].value]
        );
        geoconnexComponent.fitMapToFeatures();
      } catch (e) {
        const message = "Error while attempting to remove related feature";
        geoconnexComponent.generateAppMessage(`${message}: ${e.message}`);
        geoconnexComponent.error(message, e);
      }

      // re-enable the item for selection
      geoconnexComponent.features.forEach((it) => {
        if (remove[0].value === it.uri) {
          it.disabled = false;
        }
      });
    }
  }

  isLoading = false
  
  ////// Geoconnex collection and feature data structures + configuration //////
  collections = []
  features = []
  collectionsSelectedToSearch = []
  selectedReferenceFeatures = []
  ignoredCollections = []
  // collection = features that will not be mapped or allowed for list selection
  ignoredFeatures = {
    nat_aq: ["N9999OTHER"],
    principal_aq: [999],
  }
  featureNameMap = {}

  ////// Fetching and cacheing //////
  geoCache = null
  cacheName = "geoconnexCache"
  cacheDuration = 0
  enforceCacheDuration = false
  geoconnexUrl = "https://reference.geoconnex.us/collections"
  limitNumberOfFeaturesPerRequest = limitNumberOfFeaturesPerRequest

  ////// Mapping //////
  showingMap = true
  isInitializingMap: boolean = false
  map = null
  spatialExtentGroup = null
  searchFeatureGroup = null
  selectedFeatureGroup = null
  searchLayerGroupDictionary = {} // dictionary of {collection.id, layerGroup} for layerGroups in searchFeatureGroup
  selectedLayerDictionary = {} // dictionary of {feature.uri, leafletLayer.id} for layers in selectedFeatureGroup
  layerControl = null // Leaflet layerControl
  largeExtentWarningThreshold = 5e11 // square meter area above which warning is provided
  fitBoundsMaxZoom = 9
  expandLayerControlOnAdd = false
  shouldFitMapAfterAddingLayers = false
  onlyZoomInNotOutAfterLayerAddition = true
  bbox = null
  resSpatialExtentArea = null
  resSpatialType = null
  abortController = {}

  ////// Messages and logging //////
  searchingDescription = ""
  searchResultString = ""
  appMessages = [] // notifications displayed at top of App
  collectionMessages = [] // notifications displayed below "Collection" autoselect
  error = console.error.bind(
    window.console,
    "%cGeoconnex error:",
    "color: white; background:blue;"
  )

  ////// State //////
  loadingRelations = true
  loadingCollections = true
  lockCollectionsInput = false
  limitToSingleCollection = true
  hasSearches = false

  ////// VUE utility //////
  collectionTypeahead = null
  itemTypeahead = null
  featureRules = null

  ////// UI "theme" //////
  stringLengthLimit = 40 // after which ellipse...
  featureMessageColor = "orange"
  collectionColor = "orange"
  mappedPointFillColor = "rgba(255, 165, 0, 0.32)"
  collectionSearchColor = "orange"
  featureSelectColor = "rgba(0,0,0,.87)"
  spatialExtentColor = "rgb(51, 136, 255)"

  get pointLat() {
    return this.jsonData.spatialCoverage.geo.box[0] || null;
  }
  get pointLong() {
    return this.jsonData.spatialCoverage.geo.box[1] || null;
  }

  // https://schema.org/box
  // The first point is the lower corner, the second point is the upper corner. A box is expressed as two points separated by a space character.
  get northLat() {
    const box = this.jsonData.spatialCoverage.geo.box;
    return box ? parseFloat(box.split(" ")[0]) : null
  }
  get eastLong() {
    const box = this.jsonData.spatialCoverage.geo.box;
    return box ? parseFloat(box.split(" ")[1]) : null;
  }
  get southLat() {
    const box = this.jsonData.spatialCoverage.geo.box;
    return box ? parseFloat(box.split(" ")[2]) : null;
  }
  get westLong() {
    const box = this.jsonData.spatialCoverage.geo.box;
    return box ? parseFloat(box.split(" ")[3]) : null;
  }

  get hasSearchesWithouIssues(): boolean {
    const GeoConnex = this;
      return (
        GeoConnex.hasSearches &&
        !GeoConnex.searchResultString &&
        GeoConnex.searchingDescription == ""
      );
  }

  beforeMount() {
    this.setCustomFeatureRules();
  }
  async mounted() {
    const geoconnexApp = this;
    geoconnexApp.abortController = new AbortController();
    geoconnexApp.isLoading = true;
    geoconnexApp.configureLogging();
    
    if (
      geoconnexApp.resMode == "Edit" ||
      geoconnexApp.jsonData.relation.length > 0
    ) {
      geoconnexApp.geoCache = await caches.open(geoconnexApp.cacheName);
      
      // Only initialize map immediately if showingMap is true
      if (geoconnexApp.showingMap) {
        geoconnexApp.initializeLeafletMap();
      }
      
      geoconnexApp.resMode == "Edit" && geoconnexApp.fetchCollections(false);
      await geoconnexApp.loadResourceMetadataRelations();

      geoconnexApp.updateAppWithResSpatialExtent();
      
      // Only fit map if it's showing
      if (geoconnexApp.showingMap && geoconnexApp.map) {
        geoconnexApp.fitMapToFeatures({ group: null, overrideShouldFit: true });
      }
    }
    geoconnexApp.isLoading = false;
  }

  /* --------------------------------------------------
  Resource Metadata Modification Methods
  -------------------------------------------------- */
  async loadResourceMetadataRelations() {
    const geoconnexApp = this;
    try {
      const promises = [];
      for (const relation of geoconnexApp.jsonData.relation) {
        if (this.isGeoconnexUrl(relation.value)) {
          promises.push(geoconnexApp.fetchSingleFeature(relation));
        } else {
          geoconnexApp.selectedReferenceFeatures.push(relation);
        }
      }
      const results = await Promise.all(promises);
      const features = results.flat().filter(Boolean);
      if (!features) {
        throw new Error("No features returned from fetch");
      }
      for (let feature of features) {
        feature = await geoconnexApp.getFeatureProperties(feature);
        feature.disabled = true;
        geoconnexApp.features.push(feature);
        geoconnexApp.addSelectedFeatureToMap(feature);
        const featureValues = {
          id: feature.relationId,
          text: feature.text,
          value: feature.uri,
        };
        geoconnexApp.selectedReferenceFeatures.push(featureValues);
      }
      geoconnexApp.loadingRelations = false;
    } catch (e) {
      const message =
        "Error while attempting to load related features from metadata";
      geoconnexApp.error(message, e);
      geoconnexApp.generateAppMessage(`${message}: ${e.message}`);
    }
  }
  addSelectedFeatureToResMetadata(feature) {
    const geoconnexApp = this;
    geoconnexApp.addSelectedFeatureToMap(feature);
    geoconnexApp.saveFeatureToResMetadata(feature);

    // disable so that it can't be duplicated
    geoconnexApp.features.forEach((it) => {
      if (feature.uri === it.uri) {
        it.disabled = true;
      }
    });
  }
  addSelectedFeatureToMap(feature) {
    const geoconnexApp = this;
    if (typeof feature === "string") return;
    if (!feature.geometry) {
      geoconnexApp.fetchGeometryForSingleFeature(feature).then((geometry) => {
        feature.geometry = geometry.geometry;
      });
    }
    geoconnexApp.addGeojsonToMap({
      geojson: feature,
      fit: false,
      style: undefined,
      group: geoconnexApp.selectedFeatureGroup,
    });
  }
  saveFeatureToResMetadata(feature) {
    const geoconnexApp = this;
    
    const newRelation = {
      text: feature.text || feature,
      value: feature.uri ? feature.uri : feature,
      type: "relation"
    };
    
    // Update the local data object
    if (!geoconnexApp.jsonData.relation) {
      geoconnexApp.jsonData.relation = [];
    }
    
    // Check if relation already exists
    const existingIndex = geoconnexApp.jsonData.relation.findIndex(
      rel => rel.value === newRelation.value
    );
    
    if (existingIndex === -1) {
      geoconnexApp.jsonData.relation.push(newRelation);
    } else {
      // Update existing relation
      geoconnexApp.jsonData.relation[existingIndex] = newRelation;
    }
    
    // Update the selected features UI
    geoconnexApp.selectedReferenceFeatures.push({
      id: Date.now().toString(), // Generate a temporary ID
      value: feature.uri ? feature.uri : feature,
      text: feature.text ? feature.text : feature,
    });
    
    geoconnexApp.log(`Added ${newRelation.text} to local metadata`);
  }

  removeFeatureFromResMetadata(relations) {
    const geoconnexApp = this;
    
    // Remove each relation from the local data
    for (const relation of relations) {
      const relationIndex = geoconnexApp.jsonData.relation.findIndex(
        rel => rel.value === relation.value
      );
      
      if (relationIndex > -1) {
        geoconnexApp.jsonData.relation.splice(relationIndex, 1);
      }
    }
    
    geoconnexApp.log(`Removed ${relations.length} feature(s) from local metadata`);
  }
  limitSelectableFeaturesToSearch() {
    const geoconnexApp = this;
    geoconnexApp.loadingRelations = true;

    // remove all features currently not in the map search
    let keep = [];
    for (const val of Object.values(
      geoconnexApp.searchLayerGroupDictionary
    )) {
      if (!val.uris.includes(undefined)) {
        keep = keep.concat(val.uris);
      }
    }
    geoconnexApp.features = geoconnexApp.features.filter((s) => {
      const ignoredDict = geoconnexApp.ignoredFeatures[s.collection];
      if (ignoredDict && ignoredDict.includes(s.id)) return false;
      return keep.includes(s.uri);
    });
    geoconnexApp.loadingRelations = false;
  }
  /* --------------------------------------------------
  Fetch Request Methods
  -------------------------------------------------- */
  async fetchCollections(forceFresh = false) {
    const geoconnexApp = this;
    geoconnexApp.loadingCollections = true;
    try {
      const response = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
        url: `${geoconnexApp.geoconnexUrl}?f=json&skipGeometry=true`,
        forceFresh: forceFresh,
      });
      geoconnexApp.collections = response.collections.filter((col) => {
        return !geoconnexApp.ignoredCollections.includes(col.id);
      });
    } catch (e) {
      geoconnexApp.error("Error while loading collections", e);
    }
    geoconnexApp.loadingCollections = false;
  }
  fetchGeoconnexFeaturesContainingPoint(
    lat = null,
    long = null,
    collections = null
  ) {
    const geoconnexApp = this;
    long = typeof long == "number" ? long : geoconnexApp.pointLong;
    lat = typeof lat == "number" ? lat : geoconnexApp.pointLat;
    geoconnexApp.map.closePopup();

    const bbox = [long, lat, long + 10e-12, lat + 10e-12];
    geoconnexApp.fetchGeoconnexFeaturesInBbox({
      bbox: bbox,
      collections: collections,
    });
  }
  async fetchGeoconnexFeaturesInBbox({ bbox = null, collections = null }) {
    const geoconnexApp = this;
    if (!bbox) bbox = geoconnexApp.bbox;
    let features = [];
    geoconnexApp.map.closePopup();
    try {
      if (!collections || collections.length === 0) {
        // fetch features from all collections
        collections = geoconnexApp.collections;
      }

      const promises = [];
      for (let collection of collections) {
        const featureCount =
          await geoconnexApp.countFeaturesFromSingleCollectionInBbox({
            collection: collection,
            bbox: bbox,
          });
        if (featureCount >= limitNumberOfFeaturesPerRequest) {
          geoconnexApp.searchResultString = `Your search in ${collection.id} returned too many features.
          The limit is ${limitNumberOfFeaturesPerRequest} so no geometries were mapped.
          We recommend that you refine resource extent, conduct a point search by clicking on the map, or search using map bounds.`;
          return;
        }
        promises.push(
          geoconnexApp.fetchFeaturesFromSingleCollectionInBbox(
            collection,
            bbox
          )
        );
        if (!geoconnexApp.collectionsSelectedToSearch.includes(collection)) {
          geoconnexApp.collectionsSelectedToSearch.push(collection);
        }
      }
      const results = await Promise.all(promises);
      features = results.flat().filter(Boolean);
      if (features.length > 0) {
        geoconnexApp.searchResultString = "";
        geoconnexApp.addSearchFeaturesToMap(features);
      } else {
        geoconnexApp.searchResultString = `Your search didn't return any features.`;
        geoconnexApp.mapDisplayNoFoundFeatures(bbox);
      }
    } catch (e) {
      geoconnexApp.error(
        "Error while attempting to find intersecting geometries",
        e
      );
    }
  }
  async fetchFeaturesFromSingleCollectionInBbox(
    collection,
    bbox = null,
    refresh = false
  ) {
    const geoconnexApp = this;
    geoconnexApp.searchingDescription = collection.description;
    let response = {};
    let nameProperty = await geoconnexApp.getFeatureNameField(collection.id);
    nameProperty = nameProperty ? `,${nameProperty}` : "";
    const propertiesParameter = `&properties=uri${nameProperty}`;
    const bboxParameter = bbox ? `&bbox=${bbox.toString()}` : "";
    const query = `${geoconnexApp.geoconnexUrl}/${collection.id}/${geoconnexBaseURLQueryParam}${propertiesParameter}${bboxParameter}`;
    response = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
      url: query,
      forceFresh: refresh,
    });
    geoconnexApp.searchingDescription = "";

    // store the collection for future reference
    response &&
      response.features.forEach((feature) => {
        feature.collection = collection;
      });
    return response ? response.features : null;
  }
  async countFeaturesFromSingleCollectionInBbox({
    collection = null,
    bbox = null,
    refresh = false,
  }) {
    const geoconnexApp = this;
    let response = {};
    const propertiesParameter = "&properties=fid";
    const bboxParameter = bbox ? `&bbox=${bbox.toString()}` : "";
    const query = `${geoconnexApp.geoconnexUrl}/${collection.id}/${geoconnexBaseURLQueryParam}${propertiesParameter}&skipGeometry=true${bboxParameter}`;
    response = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
      url: query,
      forceFresh: refresh,
    });
    return response ? response.features.length : 0;
  }
  async fetchGeometryForSingleFeature(geoconnexObj, refresh = false) {
    const geoconnexApp = this;
    geoconnexApp.searchingDescription = geoconnexObj.collection;
    if (refresh || !geoconnexObj.geometry) {
      const query = `${geoconnexApp.geoconnexUrl}/${geoconnexObj.collection}/items/${geoconnexObj.id}?f=json`;
      const response = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
        url: query,
        forceFresh: refresh,
      });
      geoconnexObj.geometry = response.geometry;
    }
    geoconnexApp.searchingDescription = "";
    return geoconnexObj;
  }
  async fetchSingleFeature(relation) {
    const geoconnexApp = this;
    try {
      const uri = relation.value;
      geoconnexApp.searchingDescription = uri;
      const relative_id = uri.split("ref/").pop();
      const collection = relative_id.split("/")[0];
      const id = relative_id.split("/")[1];
      const query = `${geoconnexApp.geoconnexUrl}/${collection}/items/${id}?f=json`;
      const response = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
        url: query,
      });
      geoconnexApp.searchingDescription = "";
      response.relationId = relation.id;
      return response;
    } catch (e) {
      const message = `Error fetching Geoconnex feature`;
      geoconnexApp.generateAppMessage(`${message}: ${e.message}`);
      geoconnexApp.error(message, e);
    }
  }
  async fetchFeaturesInCollection({
    collection = {},
    forceFresh = false,
    skipGeometry = true,
  }) {
    const geoconnexApp = this;
    let nameProperty = await geoconnexApp.getFeatureNameField(collection.id);
    nameProperty = nameProperty ? `,${nameProperty}` : "";
    const propertiesParameter = `&properties=uri${nameProperty}`;
    const url = `${geoconnexApp.geoconnexUrl}/${
      collection.id
    }/${geoconnexBaseURLQueryParam}${propertiesParameter}&skipGeometry=${skipGeometry.toString()}`;
    const featureCollection = await geoconnexApp.fetchURLFromCacheOrGeoconnex(
      {
        url: url,
        forceFresh: forceFresh,
      }
    );
    featureCollection.collection = collection;
    return featureCollection;
  }
  async fetchURLFromCacheOrGeoconnex({
    url,
    forceFresh = false,
    collection = null,
  }) {
    const geoconnexApp = this;
    let data = {};
    try {
      if (!("caches" in window)) {
        geoconnexApp.log(
          "Cache API not available. Fetching geoconnex data from:\n" + url
        );
        const fetch_resp = await fetch(url);
        if (!fetch_resp.ok) {
          const message =
            "Error while attempting to fetch data from Geoconnex";
          geoconnexApp.generateAppMessage(
            `${message}: ${fetch_resp.statusText}`
          );
          geoconnexApp.error(message, fetch_resp);
        } else {
          data = await fetch_resp.json();
        }
      } else {
        const cache_resp = await geoconnexApp.geoCache.match(url);
        if (geoconnexApp.isCacheValid(cache_resp) && !forceFresh) {
          geoconnexApp.log("Using Geoconnex from cache for:\n" + url);
          data = await cache_resp.json();
        } else {
          data = await geoconnexApp.fetchURLFromGeoconnex(url);
        }
      }
      if (collection && data) {
        data.collection = collection;
      }
      return data;
    } catch (e) {
      const message = `Error while attempting to fetch Geoconnex relations`;
      geoconnexApp.generateAppMessage(`${message}: ${e.message}`);
      geoconnexApp.error(message, e);
    }
  }
  async fetchURLFromGeoconnex(url) {
    let fetchData = {};
    const geoconnexApp = this;

    geoconnexApp.log(
      "Fetching + adding to cache, geoconnex data from:\n" + url
    );
    try {
      const fetch_resp = await fetch(url);
      if (!fetch_resp.ok) {
        const message = "Error while attempting to fetch Geoconnex relations";
        geoconnexApp.generateAppMessage(
          `${message}: ${fetch_resp.statusText}`
        );
        geoconnexApp.error(message, fetch_resp);
      } else {
        const copy = fetch_resp.clone();
        const headers = new Headers(copy.headers);
        headers.append("fetched-on", new Date().getTime());
        const body = await copy.blob();
        geoconnexApp.geoCache.put(
          url,
          new Response(body, {
            status: copy.status,
            statusText: copy.statusText,
            headers: headers,
          })
        );
        fetchData = await fetch_resp.json();
      }
    } catch (e) {
      geoconnexApp.error(e.message);
      const response = await geoconnexApp.geoCache.match(url);
      if (response) {
        geoconnexApp.log(
          "Geoconnex API fetch error. Falling back to old cached version"
        );
        return response.data;
      } else {
        geoconnexApp.error(e.message);
        geoconnexApp.generateAppMessage(
          `Error while attempting to fetch Geoconnex items: ${e.message}`
        );
      }
    }
    return fetchData;
  }

  /* --------------------------------------------------
  Mapping Methods
  -------------------------------------------------- */
  showSpatialExtent({ bbox = null, fromPoint = false } = {}) {
    const geoconnexApp = this;
    if (!bbox) bbox = geoconnexApp.bbox;
    try {
      const rect = L.rectangle(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { interactive: false }
      );
      const poly = rect.toGeoJSON();
      poly.text = "Resource Spatial Extent";
      geoconnexApp.addGeojsonToMap({
        geojson: poly,
        fit: false,
        style: {
          color: geoconnexApp.spatialExtentColor,
          fillColor: geoconnexApp.spatialExtentColor,
          fillOpacity: 0.15,
        },
        group: geoconnexApp.spatialExtentGroup,
        interactive: false,
      });

      // Convert latLngs to GeoJSON polygon
      const latLngs = rect.getLatLngs()[0];
      const polygon = {
        type: 'Polygon',
        coordinates: [latLngs.map(ll => [ll.lng, ll.lat])]
      };

      geoconnexApp.resSpatialExtentArea = area(polygon); // in square meters
      if (fromPoint) {
        // the bbox is just a tiny box generated by a point
        const geojson = {
          type: "Point",
          coordinates: [geoconnexApp.pointLong, geoconnexApp.pointLat],
          text: "Resource Spatial Extent",
        };
        geoconnexApp.addGeojsonToMap({
          geojson: geojson,
          fit: false,
          style: {},
          group: geoconnexApp.spatialExtentGroup,
          interactive: false,
          marker: true,
        });
      }
    } catch (e) {
      geoconnexApp.error("Error attempting to show spatial extent", e);
    }
  }
  initializeLeafletMap() {
    const geoconnexApp = this;
    geoconnexApp.selectedFeatureGroup = L.featureGroup();
    geoconnexApp.searchFeatureGroup = L.featureGroup();
    !geoconnexApp.spatialExtentGroup &&
      (geoconnexApp.spatialExtentGroup = L.featureGroup());
    const southWest = L.latLng(-90, -180),
      northEast = L.latLng(90, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    geoconnexApp.map = L.map("geoconnex-leaflet", {
      zoomControl: false,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      // @ts-ignore added by 'leaflet.fullscreen'
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: "bottomright",
        content: `<i class="fa-solid fa-expand" aria-hidden="true"></i>`,
      },
    });

      let Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        noWrap: true,
        variant: 'World_Imagery',
        attribution: 'Esri'
      })

    const streets = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }
    );

    const googleSat = L.tileLayer(
      "http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }
    );

    const baseMaps = {
      Streets: streets,
      "ESRI Wolrd Imagery": Esri_WorldImagery,
      Satelite: googleSat,
    };

    geoconnexApp.map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com/" target="blank">Leaflet</a>'
    );

    const overlayMaps = {
      "Selected Features": geoconnexApp.selectedFeatureGroup,
    };
    overlayMaps["Resource Spatial Extent"] = geoconnexApp.spatialExtentGroup;
    geoconnexApp.map.addLayer(geoconnexApp.spatialExtentGroup);
    if (geoconnexApp.resMode == "Edit") {
      overlayMaps["Search (all features)"] = geoconnexApp.searchFeatureGroup;
      geoconnexApp.map.addLayer(geoconnexApp.searchFeatureGroup);
    }
    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(geoconnexApp.map);

    geoconnexApp.layerControl = L.control.layers(baseMaps, overlayMaps, {
      position: "topright",
    });
    geoconnexApp.layerControl.addTo(geoconnexApp.map);

    L.Control.GeoconnexRecenterButton = L.Control.extend({
      onAdd: function (map) {
        const recenterButton = L.DomUtil.create(
          "div",
          "leaflet-bar leaflet-control"
        );
        recenterButton.setAttribute("title", "Resize to features");

        recenterButton.innerHTML = `
          <a role="button">
            <i class="fa-regular fa-circle-dot" style="padding-top:3px"></i>
          </a>
        `;

        L.DomEvent.on(recenterButton, "click", (e) => {
          e.stopPropagation();
          geoconnexApp.fitMapToFeatures({
            group: null,
            overrideShouldFit: true,
          });
        });

        return recenterButton;
      },

      onRemove: function (map) {
        L.DomEvent.off();
      },
    });

    L.control.watermark = function (opts) {
      return new L.Control.GeoconnexRecenterButton(opts);
    };

    L.control
      .watermark({
        position: "bottomright",
      })
      .addTo(geoconnexApp.map);

    // show the default layers at start
    geoconnexApp.map.addLayer(streets);
    geoconnexApp.map.addLayer(geoconnexApp.selectedFeatureGroup);

    // USA
    // geoconnexApp.map.setView([41.850033, -87.6500523], 3);
    geoconnexApp.map.setView([30, 0], 1);

    geoconnexApp.setMapEvents();
    geoconnexApp.setupMapResizeHandler();
  }
  async addSearchFeaturesToMap(features, collectionOverride = null) {
    const geoconnexApp = this;
    const abortSignal = geoconnexApp.abortController.signal;
    for (const feature of features) {
      if (abortSignal.aborted) {
        return;
      }
      // deal with collection first
      const collection = collectionOverride
        ? collectionOverride
        : feature.collection;

      if (geoconnexApp.ignoredFeatures[collection.id]?.includes(feature.id))
        return;

      // check if layergroup exists in the "dictionary"
      if (
        !geoconnexApp.searchLayerGroupDictionary ||
        geoconnexApp.searchLayerGroupDictionary[collection.id] == undefined
      ) {
        geoconnexApp.searchLayerGroupDictionary[collection.id] =
          L.layerGroup();
        geoconnexApp.searchLayerGroupDictionary[collection.id].uris = [];
        geoconnexApp.layerControl.addOverlay(
          geoconnexApp.searchLayerGroupDictionary[collection.id],
          geoconnexApp.trimString(
            collection.description,
            ` (${collection.id})`
          )
        );

        geoconnexApp.expandLayerControlOnAdd &&
          geoconnexApp.layerControl.expand();
      }
      geoconnexApp.map.addLayer(
        geoconnexApp.searchLayerGroupDictionary[collection.id]
      );

      // second deal with the actual item
      const alreadySelected = geoconnexApp.selectedReferenceFeatures.find(
        (obj) => {
          return obj.value && obj.value === feature.properties.uri;
        }
      );
      if (alreadySelected) {
        feature.disabled = true;
      } else {
        await geoconnexApp.getFeatureProperties(feature);
        if (feature.geometry.type.includes("Point")) {
          geoconnexApp.addGeojsonToMap({
            geojson: feature,
            fit: false,
            style: {
              color: geoconnexApp.collectionSearchColor,
              radius: 5,
              fillColor: geoconnexApp.mappedPointFillColor,
              fillOpacity: 0.8,
            },
            group: geoconnexApp.searchFeatureGroup,
          });
        } else {
          geoconnexApp.addGeojsonToMap({
            geojson: feature,
            fit: false,
            style: { color: geoconnexApp.collectionSearchColor },
            group: geoconnexApp.searchFeatureGroup,
          });
        }
      }
      geoconnexApp.features.push(feature);
    }
    if (features.length) {
      geoconnexApp.searchResultString = "";
      geoconnexApp.fitMapToFeatures();
      geoconnexApp.limitSelectableFeaturesToSearch();
    } else {
      geoconnexApp.searchResultString = `Your search didn't return any features.`;
    }
  }
  addGeojsonToMap({
    geojson = {},
    fit = false,
    style = { color: this.featureSelectColor, radius: 5 },
    group = null,
    interactive = true,
    marker = false,
  }) {
    const geoconnexApp = this;
    const abortSignal = geoconnexApp.abortController.signal;
    if (abortSignal.aborted) {
      return;
    }
    try {
      const leafletLayer = L.geoJSON(geojson, {
        onEachFeature: function (feature, layer) {
          let popupText = `<h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 500;">${feature.text}</h4>`;
          if (feature.uri) {
            popupText += `<a href="${feature.uri}" target="_blank" style="color: #1976d2; text-decoration: none; display: block; margin-bottom: 12px; font-size: 14px;">
              ${feature.uri}
            </a>`;
          }
          
          // Use Material Design styled buttons instead of Bootstrap
          if (
            geoconnexApp.resMode == "Edit" &&
            style.color == geoconnexApp.collectionSearchColor
          ) {
            popupText += `
              <button type="button" class="map-add-geoconnex" 
                data='${JSON.stringify(feature)}'
                style="
                  background-color: #4caf50;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  padding: 8px 16px;
                  font-size: 14px;
                  font-weight: 500;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  transition: background-color 0.2s;
                "
                onmouseover="this.style.backgroundColor='#43a047'"
                onmouseout="this.style.backgroundColor='#4caf50'"
              >
                Add Feature
              </button>`;
          } else if (
            geoconnexApp.resMode == "Edit" &&
            style.color == geoconnexApp.featureSelectColor
          ) {
            popupText += `
              <button type="button" class="map-remove-geoconnex" 
                data='${JSON.stringify(feature)}'
                style="
                  background-color: #f44336;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  padding: 8px 16px;
                  font-size: 14px;
                  font-weight: 500;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  transition: background-color 0.2s;
                "
                onmouseover="this.style.backgroundColor='#e53935'"
                onmouseout="this.style.backgroundColor='#f44336'"
              >
                Remove Feature
              </button>`;
          }
          layer.bindPopup(popupText, { maxWidth: 400 });
        },
        pointToLayer: function (feature, latlng) {
          return marker
            ? L.marker(latlng, style)
            : L.circleMarker(latlng, style);
        },
        interactive: interactive,
      });
      leafletLayer.setStyle(style);
      if (geojson.uri && group === geoconnexApp.selectedFeatureGroup) {
        geoconnexApp.selectedLayerDictionary[geojson.uri] =
          leafletLayer._leaflet_id;
      }
      if (group === geoconnexApp.searchFeatureGroup) {
        if (!geojson.collection) {
          geojson.collection = "Search Bounds";
        }
        if (!geoconnexApp.searchLayerGroupDictionary[geojson.collection]) {
          return;
        }
        geoconnexApp.searchLayerGroupDictionary[geojson.collection].addLayer(
          leafletLayer
        );
        geoconnexApp.searchLayerGroupDictionary[geojson.collection].uris.push(
          geojson.uri
        );
      }
      if (group && !group.hasLayer(leafletLayer)) {
        group?.addLayer(leafletLayer);
      }

      // handle zooming
      if (fit) {
        geoconnexApp.map.fitBounds(leafletLayer.getBounds(), {
          maxZoom: geoconnexApp.fitBoundsMaxZoom,
        });
      }
    } catch (e) {
      geoconnexApp.error(e.message);
      geoconnexApp.generateAppMessage(
        `Error while attempting to add item to map: ${e.message}`
      );
    }
  }
  fitMapToFeatures({ group = null, overrideShouldFit = false } = {}) {
    const geoconnexApp = this;
    if (!geoconnexApp.shouldFitMapAfterAddingLayers && !overrideShouldFit) {
      return;
    }
    try {
      if (group) {
        geoconnexApp.map.fitBounds(group.getBounds());
      } else {
        const bounds = L.latLngBounds();
        geoconnexApp.spatialExtentGroup &&
          bounds.extend(geoconnexApp.spatialExtentGroup.getBounds());
        geoconnexApp.searchFeatureGroup &&
          bounds.extend(geoconnexApp.searchFeatureGroup.getBounds());
        geoconnexApp.searchFeatureGroup &&
          bounds.extend(geoconnexApp.selectedFeatureGroup.getBounds());
        if (bounds.isValid()) {
          // check to see if already zoomed within bounds -- in which case dont re-zoom
          const alreadyZoomed = bounds.contains(geoconnexApp.map.getBounds());
          if (
            alreadyZoomed &&
            geoconnexApp.onlyZoomInNotOutAfterLayerAddition &&
            !overrideShouldFit
          ) {
            return;
          }
          geoconnexApp.map.fitBounds(bounds, {
            maxZoom: geoconnexApp.fitBoundsMaxZoom,
          });
        } else {
          // USA
          // geoconnexApp.map.setView([41.850033, -87.6500523], 3);
          geoconnexApp.map.setView([30, 0], 1);
        }
      }
    } catch (e) {
      geoconnexApp.error(e.message);
    }
  }
  searchForFeaturesUsingVisibleMapBounds() {
    const geoconnexApp = this;
    geoconnexApp.searchingDescription = `${
      geoconnexApp.collectionsSelectedToSearch.at(-1).description
    }`;
    geoconnexApp
      .fetchGeoconnexFeaturesInBbox({
        bbox: geoconnexApp.map.getBounds().toBBoxString(),
        collections: geoconnexApp.collectionsSelectedToSearch,
      })
      .then(() => {
        geoconnexApp.searchingDescription = "";
      });
  }
  mapDisplayNoFoundFeatures(bbox) {
    const poly = L.rectangle([
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ]);
    const loc = poly.getBounds().getCenter();
    const content = `<div data='${JSON.stringify(
      loc
    )}'>No features found for your search.</div>`;
    L.popup({ maxWidth: 400, autoClose: true })
      .setLatLng(loc)
      .setContent(content)
      .openOn(geoconnexApp.map);
  }
  async clearMapOfSearches() {
    const geoconnexApp = this;
    geoconnexApp.abortController.abort();
    geoconnexApp.abortController = new AbortController();
    for (const key in geoconnexApp.searchLayerGroupDictionary) {
      geoconnexApp.layerControl.removeLayer(
        geoconnexApp.searchLayerGroupDictionary[key]
      );
      delete geoconnexApp.searchLayerGroupDictionary[key];
    }

    geoconnexApp.hasSearches = false;
    geoconnexApp.collectionsSelectedToSearch = [];
    geoconnexApp.searchFeatureGroup.clearLayers();
    geoconnexApp.fitMapToFeatures();
    geoconnexApp.layerControl.collapse();
  }
  updateSpatialExtentType() {
    const geoconnexApp = this;
    geoconnexApp.resSpatialType = null;
    if (
      !geoconnexApp.jsonData.spatialCoverage ||
      !geoconnexApp.jsonData.spatialCoverage.type
    )
      return;
    geoconnexApp.resSpatialType = geoconnexApp.jsonData.spatialCoverage.geo.type;
  }
  updateAppWithResSpatialExtent() {
    const geoconnexApp = this;
    geoconnexApp.updateSpatialExtentType();
    geoconnexApp.spatialExtentGroup.clearLayers();
    if (!geoconnexApp.resSpatialType) {
      geoconnexApp.log("Resource spatial extent isn't set");
      geoconnexApp.bbox = null;
      return;
    }
    if (geoconnexApp.resSpatialType != "GeoShape") {
      geoconnexApp.log("Setting point spatial extent");

      // Geoconnex API only acccepts bounding box
      // if point, just make it a small bounding box
      let bbox = [
        geoconnexApp.pointLong,
        geoconnexApp.pointLat,
        geoconnexApp.pointLong + 1e-12,
        geoconnexApp.pointLat + 1e-12,
      ];
      geoconnexApp.bbox = bbox;
      geoconnexApp.showSpatialExtent({ bbox: null, fromPoint: true });
    } else {
      geoconnexApp.log("Setting box spatial extent");

      const bbox = [
        geoconnexApp.eastLong,
        geoconnexApp.southLat,
        geoconnexApp.westLong,
        geoconnexApp.northLat,
      ];
      geoconnexApp.bbox = bbox;
      geoconnexApp.showSpatialExtent();
    }
  }
  fillCoordinatesFromClickedCoordinates(lat, long) {
    const geoconnexApp = this;
    geoconnexApp.pointLat = lat;
    geoconnexApp.pointLong = long;
  }
  /* --------------------------------------------------
  Event Delegation Methods (Replaces jQuery)
  -------------------------------------------------- */
  setupEventDelegation() {
    const geoconnexApp = this;
    
    // Get the map container
    const mapContainer = document.getElementById('geoconnex-leaflet');
    if (!mapContainer) return;
    
    // Single event listener for all dynamic buttons
    mapContainer.addEventListener('click', function(e) {
      // Handle Add Feature button clicks
      const addButton = e.target.closest('.map-add-geoconnex');
      if (addButton) {
        e.stopPropagation();
        e.preventDefault();
        const data = JSON.parse(addButton.getAttribute('data'));
        const alreadySelected = geoconnexApp.selectedReferenceFeatures.find(
          (obj) => obj.value === data.uri
        );
        if (!alreadySelected) {
          geoconnexApp.addSelectedFeatureToResMetadata(data);
        }
        geoconnexApp.map.closePopup();
        return;
      }
      
      // Handle Remove Feature button clicks
      const removeButton = e.target.closest('.map-remove-geoconnex');
      if (removeButton) {
        e.stopPropagation();
        e.preventDefault();
        const data = JSON.parse(removeButton.getAttribute('data'));
        geoconnexApp.selectedReferenceFeatures =
          geoconnexApp.selectedReferenceFeatures.filter(
            (s) => s.value !== data.uri
          );
        geoconnexApp.map.closePopup();
        return;
      }
      
      // Handle point search button clicks
      const pointSearchButton = e.target.closest('.leaflet-point-search');
      if (pointSearchButton) {
        e.stopPropagation();
        e.preventDefault();
        const loc = JSON.parse(pointSearchButton.getAttribute('data'));
        geoconnexApp.fillCoordinatesFromClickedCoordinates(
          loc.lat,
          loc.long
        );
        geoconnexApp.fetchGeoconnexFeaturesContainingPoint(
          loc.lat,
          loc.long,
          geoconnexApp.collectionsSelectedToSearch
        );
        return;
      }
    });
  }
  setupMapResizeHandler() {
    const geoconnexApp = this;
    
    // Handle window resize to fix map rendering
    const handleResize = () => {
      if (geoconnexApp.map) {
        setTimeout(() => {
          geoconnexApp.map.invalidateSize();
        }, 100);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up in beforeUnmount or unmounted lifecycle hook
    geoconnexApp.cleanupResizeHandler = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  setMapEvents() {
    const geoconnexApp = this;
    var popup = L.popup({ maxWidth: 400 });

    function onMapClick(e) {
      if (!geoconnexApp.hasSearches) return;
      const loc = { lat: e.latlng.lat, long: e.latlng.lng };
      const content = `
        <button class="leaflet-point-search" 
          data='${JSON.stringify(loc)}'
          style="
            background-color: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
            width: 100%;
            justify-content: center;
          "
          onmouseover="this.style.backgroundColor='#1976d3'"
          onmouseout="this.style.backgroundColor='#2196f3'"
        >
          <span class="mdi mdi-map-marker" style="font-size: 18px;"></span>
          Find features containing this point
        </button>`;
      popup.setLatLng(e.latlng).setContent(content).openOn(geoconnexApp.map);
    }

    if (geoconnexApp.resMode === "Edit") {
      geoconnexApp.map.on("click", onMapClick);
    }
    
    // Setup event delegation for dynamic buttons
    geoconnexApp.setupEventDelegation();
  }

  toggleMapVisibility() {
    const geoconnexApp = this;
    
    if (!geoconnexApp.showingMap) {
      // Show map
      geoconnexApp.showingMap = true;
      geoconnexApp.isInitializingMap = true;
      
      // Use $nextTick to ensure DOM is updated before initializing map
      geoconnexApp.$nextTick(() => {
        if (geoconnexApp.map == null) {
          geoconnexApp.initializeLeafletMap();
        } else {
          // If map already exists but was hidden, we need to properly reinitialize it
          // First, clean up the old map completely
          if (geoconnexApp.map) {
            geoconnexApp.map.remove();
            geoconnexApp.map = null;
          }
          
          // Clear any existing leaflet container
          const leafletContainer = document.getElementById('geoconnex-leaflet');
          if (leafletContainer) {
            leafletContainer.innerHTML = '';
          }
          
          // Reinitialize the map
          geoconnexApp.initializeLeafletMap();
        }
        
        // Reset loading state after a short delay
        setTimeout(() => {
          geoconnexApp.isInitializingMap = false;
        }, 800);
      });
    } else {
      // Hide map
      geoconnexApp.showingMap = false;
      
      // Clean up map resources when hiding
      if (geoconnexApp.map) {
        // Remove event listeners first
        geoconnexApp.map.off();
        
        // Clean up layers
        if (geoconnexApp.layerControl) {
          geoconnexApp.layerControl.remove();
          geoconnexApp.layerControl = null;
        }
        
        // Clear the map container but keep the element
        const leafletContainer = document.getElementById('geoconnex-leaflet');
        if (leafletContainer) {
          leafletContainer.innerHTML = '';
        }
        
        // Don't remove the map object entirely, just clean up
        geoconnexApp.map.remove();
        geoconnexApp.map = null;
      }
    }
  }

  /* --------------------------------------------------
  Utility Methods
  -------------------------------------------------- */
  createVuetifySelectSubheader(collection) {
    return {
      header: `${collection.description} (${collection.id})`,
      text: `${collection.description} (${collection.id})`,
    };
  }
  generateAppMessage(message, level = "danger") {
    const geoconnexApp = this;
    if (level === "danger")
      message += " -- If this issue persists, please notify help@cuahsi.org.";
    if (!geoconnexApp.appMessages.some((m) => m.message === message)) {
      geoconnexApp.appMessages.push({ message: message, level: level });
    }
  }
  async setFeatureName(feature) {
    if (feature.NAME) return;
    const geoconnexApp = this;
    let nameField;
    if (feature.collection in geoconnexApp.featureNameMap) {
      nameField = geoconnexApp.featureNameMap[feature.collection];
    } else {
      nameField = await geoconnexApp.getFeatureNameField(feature.collection);
      geoconnexApp.featureNameMap[feature.collection] = nameField;
    }
    feature.NAME = feature.properties[nameField] || "";
  }
  async getFeatureNameField(collectionName) {
    const geoconnexApp = this;
    if (collectionName in geoconnexApp.featureNameMap) {
      return geoconnexApp.featureNameMap[collectionName];
    }
    const url = `${geoconnexApp.geoconnexUrl}/${collectionName}/items?f=jsonld&lang=en-US&skipGeometry=true&limit=1`;
    // don't fetch the contexts from cache, get it direct from Geoconnex api
    const featureJsonLd = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
      url: url,
      forceFresh: true,
    });
    const contexts = featureJsonLd["@context"];
    for (let context of contexts) {
      const nameField = Object.keys(context).find(
        (key) => context[key] === "schema:name"
      );
      if (nameField) {
        geoconnexApp.featureNameMap[collectionName] = nameField;
        return nameField;
      }
    }
    return geoconnexApp.getFirstFeatureNameField(collectionName);
  }
  /**
    * Gracefully handle when there is no name field in a collection schema
    * @param  {String} collectionName Name of the geoconnex collection
    * @return {String} Key of the first feature property that resembles a potential name
    */
  async getFirstFeatureNameField(collectionName) {
    const geoconnexApp = this;
    const url = `${geoconnexApp.geoconnexUrl}/${collectionName}/items?f=json&lang=en-US&skipGeometry=true&limit=1`;
    const featureJson = await geoconnexApp.fetchURLFromCacheOrGeoconnex({
      url: url,
      forceFresh: true,
    });
    const properties = featureJson.features[0].properties;
    const match = Object.keys(properties).filter((key) =>
      /.*name.*/i.test(key)
    );
    let first = match[0];
    if (first) {
      geoconnexApp.featureNameMap[collectionName] = first;
      return first;
    }
    return "";
  }
  async getFeatureProperties(feature) {
    const geoconnexApp = this;
    // Account for some oddities in the Geoconnex API schema
    feature.relative_id = feature.properties.uri.split("ref/").pop();
    feature.collection = feature.relative_id.split("/")[0];
    feature.uri = feature.properties.uri;
    await geoconnexApp.setFeatureName(feature);
    feature.text = `${feature.NAME} [${feature.relative_id}]`;

    //prevent duplicate selections
    geoconnexApp.selectedReferenceFeatures.forEach((it) => {
      if (feature.uri === it.value) {
        feature.disabled = true;
      }
    });
    return feature;
  }
  isUrl(stringToTest) {
    try {
      new URL(stringToTest);
    } catch (_) {
      return false;
    }
    return true;
  }
  isGeoconnexUrl(stringToTest) {
    return this.isUrl(stringToTest) && stringToTest.indexOf("geoconnex") > -1;
  }
  trimString(longString, append = "") {
    const geoconnexApp = this;
    return longString.length + append.length > geoconnexApp.stringLengthLimit
      ? `${longString.substring(
          0,
          geoconnexApp.stringLengthLimit - append.length
        )}...${append}`
      : longString;
  }
  until(conditionFunction) {
    const geoconnexApp = this;
    geoconnexApp.log(`Waiting for [ ${conditionFunction} ] to resolve...`);
    const poll = (resolve) => {
      if (conditionFunction()) {
        geoconnexApp.log(`Promise for [ ${conditionFunction} ] resolved`);
        resolve();
      } else setTimeout((_) => poll(resolve), 400);
    };
    return new Promise(poll);
  }
  isCacheValid(response) {
    const geoconnexApp = this;
    if (!response || !response.ok) return false;
    if (geoconnexApp.enforceCacheDuration) {
      var fetched = response.headers.get("fetched-on");
      if (
        fetched &&
        parseFloat(fetched) + geoconnexApp.cacheDuration >
          new Date().getTime()
      )
        return true;
      geoconnexApp.log("Cached data not valid.");
      return false;
    }
    return true;
  }
  setCustomFeatureRules() {
    const geoconnexApp = this;
    geoconnexApp.featureRules = [
      function (v) {
        const invalid = [];
        for (const item of v) {
          try {
            url = new URL(item.value);
          } catch (_) {
            invalid.push(item.text);
          }
        }
        if (invalid.length === 1) {
          return `"${invalid}" is not a valid URI. We recommend that your custom feature be linkable`;
        }
        if (invalid.length === 2) {
          return `"${invalid.join(
            '" and "'
          )}" are not a valid URIs. We recommend that custom features be linkable.`;
        }
        if (invalid.length > 2) {
          return `"${invalid
            .join('", "')
            .replace(
              /, ([^,]*)$/,
              " and $1"
            )}" are not a valid URIs. We recommend that custom features be linkable`;
        }
        return true;
      },
    ];
  }
  configureLogging() {
    const geoconnexApp = this;
    if (geoconnexAppVerbose) {
      geoconnexApp.log = console.log.bind(
        window.console,
        "%cGeoconnex:",
        "color: white; background:blue;"
      );
    } else {
      geoconnexApp.log = function () {};
    }
  }
  beforeUnmount() {
    if (this.cleanupResizeHandler) {
      this.cleanupResizeHandler();
    }
    
    // Also clean up map to prevent memory leaks
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
export default toNative(GeoConnex);
</script>
<style scoped>
#app-geoconnex {
  padding: 1rem;
}

#app-geoconnex .flex {
  flex-direction: row;
  gap: 2rem;
}

#geoconnex-message-wrapper {
  margin-bottom: 1rem;
}

/* Alert styling to match Vuetify */
#app-geoconnex .alert {
  border: none;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.5;
}

#app-geoconnex .alert-info {
  background-color: #e3f2fd;
  color: #0d47a1;
  border-left: 4px solid #2196f3;
}

#app-geoconnex .alert-warning {
  background-color: #fff3e0;
  color: #e65100;
  border-left: 4px solid #ff9800;
}

#app-geoconnex .alert-danger {
  background-color: #ffebee;
  color: #b71c1c;
  border-left: 4px solid #f44336;
}

#app-geoconnex .alert .close {
  opacity: 0.7;
  color: inherit;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

#app-geoconnex .alert .close:hover {
  opacity: 1;
}

#geoconnex-controls {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  flex-direction: row;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

#app-geoconnex .opaque #geoconnex-leaflet {
  opacity: 0.4;
  filter: alpha(opacity=40);
  pointer-events: none;
}

#geoconnex-map-wrapper {
  flex: 2 1 500px;
}

#geoconnex-leaflet {
  z-index: 2;
}

#geoconnex-controls-wrapper {
  padding-right: 12px;
  padding-left: 12px;
}

#geoconnex-leaflet {
  height: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.leaflet-control-container,
.leaflet-popup {
  font-size: 14px !important;
}

#app-geoconnex .dataset-details {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 8px 0;
}

/* Button overrides to match Vuetify */
.v-application .btn {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.0892857143em;
  text-transform: uppercase;
  transition: all 0.2s ease;
  cursor: pointer;
}

.v-application .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.v-application .btn i.fa {
  margin-right: 0.5rem;
}

/* Map popup buttons */
.map-add-geoconnex,
.map-remove-geoconnex,
.leaflet-point-search {
  font-size: 12px !important;
  padding: 4px 8px !important;
  margin-top: 8px;
}

/* Table styling to match Vuetify */
#app-geoconnex .info-table-wrapper {
  margin-top: 1rem;
}

#app-geoconnex .hs-table {
  width: 100%;
  border-collapse: collapse;
}

#app-geoconnex .hs-table tr {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

#app-geoconnex .hs-table tr:last-child {
  border-bottom: none;
}

#app-geoconnex .hs-table td {
  padding: 12px 0;
}

#app-geoconnex .hs-table .dataset-details a {
  color: #1976d2;
  text-decoration: none;
}

#app-geoconnex .hs-table .dataset-details a:hover {
  text-decoration: underline;
}

/* Tooltip styling */
[data-toggle="tooltip"] {
  cursor: help;
}

/* Remove old Bootstrap-specific styles */
#app-geoconnex .glyphicon-remove-circle,
#app-geoconnex .glyphicon-info-sign {
  /* These are Bootstrap icons - consider replacing with Material Icons */
  font-family: 'Material Icons', sans-serif;
}

/* Use Material Icons instead of Glyphicons if possible */
.glyphicon-info-sign:before {
  content: "info";
  font-family: 'Material Icons';
}

.glyphicon-remove-circle:before {
  content: "cancel";
  font-family: 'Material Icons';
}

/* Responsive adjustments */
@media (max-width: 1264px) {
  #geoconnex-map-wrapper,
  #geoconnex-controls-wrapper {
    width: 100%;
    flex: 1 1 100%;
  }
  
  #geoconnex-leaflet {
    height: 300px;
  }
}

/* Vuetify component spacing */
#app-geoconnex .v-autocomplete,
#app-geoconnex .v-combobox {
  margin-bottom: 16px;
}

#app-geoconnex .text-muted {
  color: rgba(0, 0, 0, 0.6) !important;
}

/* Chip styling for selected features */
#app-geoconnex .v-chip {
  margin: 2px;
}

/* Progress bar styling */
#app-geoconnex .v-progress-linear {
  margin-bottom: 8px;
}

/* Map info text */
#geoconnex-leaflet-info {
  color: rgba(0, 0, 0, 0.6);
  font-size: 12px;
  margin-top: 8px;
  line-height: 1.4;
}

/* Remove old button gradient styles and replace with Vuetify-like colors */
.v-application .btn-info {
  background-color: #2196f3 !important;
  border-color: #2196f3 !important;
  color: white !important;
}

.v-application .btn-success {
  background-color: #4caf50 !important;
  border-color: #4caf50 !important;
  color: white !important;
}

.v-application .btn-danger {
  background-color: #f44336 !important;
  border-color: #f44336 !important;
  color: white !important;
}

.v-application .btn-warning {
  background-color: #ff9800 !important;
  border-color: #ff9800 !important;
  color: white !important;
}

.v-application .btn-default {
  background-color: #f5f5f5 !important;
  border-color: rgba(0, 0, 0, 0.12) !important;
  color: rgba(0, 0, 0, 0.87) !important;
}

/* Remove text shadows for cleaner look */
.v-application .btn-info,
.v-application .btn-primary,
.v-application .btn-success,
.v-application .btn-danger,
.v-application .btn-warning {
  text-shadow: none;
}

.v-application .btn-default:not(.active) {
  text-shadow: none;
}

/* Add hover effects */
.v-application .btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.v-application .btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Style for Leaflet popup buttons */
.leaflet-popup-content button {
  font-family: 'Roboto', sans-serif !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}

.leaflet-popup-content .map-add-geoconnex,
.leaflet-popup-content .map-remove-geoconnex,
.leaflet-popup-content .leaflet-point-search {
  font-family: 'Roboto', sans-serif !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  border-radius: 4px !important;
  padding: 8px 16px !important;
  cursor: pointer !important;
  transition: background-color 0.2s, box-shadow 0.2s !important;
  border: none !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.leaflet-popup-content .map-add-geoconnex {
  background-color: #4caf50 !important;
  color: white !important;
}

.leaflet-popup-content .map-add-geoconnex:hover {
  background-color: #43a047 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}

.leaflet-popup-content .map-remove-geoconnex {
  background-color: #f44336 !important;
  color: white !important;
}

.leaflet-popup-content .map-remove-geoconnex:hover {
  background-color: #e53935 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}

.leaflet-popup-content .leaflet-point-search {
  background-color: #2196f3 !important;
  color: white !important;
  width: 100% !important;
  justify-content: center !important;
}

.leaflet-popup-content .leaflet-point-search:hover {
  background-color: #1976d3 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}

/* Material icons in popups */
.leaflet-popup-content .material-icons,
.leaflet-popup-content .mdi {
  font-size: 18px !important;
  line-height: 1 !important;
}

/* Popup header styling */
.leaflet-popup-content h4 {
  margin: 0 0 12px 0 !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  color: rgba(0, 0, 0, 0.87) !important;
  font-family: 'Roboto', sans-serif !important;
}

/* Popup link styling */
.leaflet-popup-content a {
  color: #1976d2 !important;
  text-decoration: none !important;
  display: block !important;
  margin-bottom: 12px !important;
  font-size: 14px !important;
  font-family: 'Roboto', sans-serif !important;
  word-break: break-all !important;
}

.leaflet-popup-content a:hover {
  text-decoration: underline !important;
}
</style>