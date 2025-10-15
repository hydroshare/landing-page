<template>
  <v-card variant="outlined" border="grey thin">
    <p>
        <i>This HydroShare resource is linked to the following geospatial features</i>
        <span v-show="resMode=='Edit'" data-toggle="tooltip" data-placement="auto"
          title='Use this section to add persistent identifiers pointing at related geospatial features.'
          class="glyphicon glyphicon-info-sign text-muted">
        </span>
    </p>
    <div id="geoconnex-message-wrapper" v-if="resMode=='Edit'">
      <div class="alert alert-info alert-dismissible" role="alert">
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">×</span>
          </button>
          <div class="flex">
              <i class="glyphicon glyphicon-info-sign"></i>
              <em style="padding-right:20px;">
                  <strong><a href="https://geoconnex.internetofwater.dev/" target="_blank">Geoconnex</a>, through the <a href="https://internetofwater.org/" target="_blank">Internet of Water</a>:</strong>
                  This field allows you to relate this resource to overlapping geospatial features
                  in order to increase the <strong><a href="https://www.go-fair.org/fair-principles/" target="_blank">FAIR</a></strong>ness and discoverability of your data.
                  Below, collections of reference features within the United States are provided.
                  Search these collections to find features that overlap with your data, or provide a URL that resolves to a geospatial feature not yet in the Geoconnex collections.
                  <br>
                  <strong>
                      <a target="_blank"
                          href="https://help.hydroshare.org/publishing-in-hydroshare/metadata-best-practices/related-geospatial-features"
                          >
                          Learn more about Related Geospatial Features
                      </a>
                  </strong>
              </em>
          </div>
      </div>
      <div v-if="!isLoading && !resSpatialType && resMode=='Edit'" class="alert alert-warning alert-dismissible mb-1" role="alert">
          <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span
              aria-hidden="true">&times;</span></button>
          <p>We highly recommend that you add Spatial Coverage to this resource before searching for related geospatial features. Otherwise query times can be excessive.</p>
      </div>
      <div v-if="resSpatialExtentArea > largeExtentWarningThreshold" class="alert alert-dismissible alert-warning" role="alert">
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">×</span>
          </button>
          <div class="flex">
              <i class="glyphicon glyphicon-info-sign"></i>
              <em style="padding-right:20px;">
                  Please note: your resource spatial extent ({{(resSpatialExtentArea * 1e-6).toFixed(0)}} square kilometers) is larger than a big US state.
                  You might experience reduced performance during your searches.
              </em>
          </div>
      </div>
      <div v-show="searchResultString" class="alert alert-warning" role="alert">
          <div class="flex">
              <em style="padding-right:20px;">
                  {{ searchResultString }}
              </em>
          </div>
      </div>
      <div v-for="messageObj in appMessages" :class="'alert alert-dismissible alert-' + messageObj.level" role="alert">
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">×</span>
          </button>
          <div class="flex">
              <i class="glyphicon glyphicon-info-sign"></i>
              <em style="padding-right:20px;">
                  {{ messageObj.message }}
              </em>
          </div>
      </div>
    </div>
    <div class="row">
          <div v-if="resMode === 'Edit'" class="col-xs-12" :class="{'col-lg-4': showingMap}" id="geoconnex-controls-wrapper">
              <v-autocomplete
                  :menu-props="{closeOnClick: true, closeOnContentClick: true}"
                  :readonly="lockCollectionsInput"
                  v-model="collectionsSelectedToSearch"
                  :items="collections"
                  :item-text="item => `${item.description} (${item.id})`"
                  :hide-no-data="!collectionTypeahead"
                  multiple
                  :loading="isLoading"
                  placeholder="Type to narrow down options or select from the list"
                  :label="limitToSingleCollection ? '1. Choose a collection to search...' : '1. Choose collections to search...'"
                  :disabled="loadingCollections || searchingDescription !==''"
                  :loading="loadingCollections || searchingDescription !==''"
                  outlined
                  hide-details
                  :color="collectionColor"
                  :item-color="collectionColor"
                  :search-input.sync="collectionTypeahead"
                  :error="searchResultString !==''"
                  return-object="true">
                      <template v-slot:item="data">
                          <template v-if="typeof data.item !== 'object'">
                              <v-list-tile-content v-text="data.item"></v-list-tile-content>
                          </template>
                          <template v-else>
                              <v-list-item-content>
                                  <v-list-item-title v-html="`${data.item.description} (${data.item.id})`"></v-list-item-title>
                              </v-list-item-content>
                          </template>
                      </template>
                      <template v-slot:no-data>
                          <v-list-item>
                              <v-list-item-content>
                                  <v-list-item-title>
                                      No collections matching "<strong>{{ collectionTypeahead }}</strong>".
                                  </v-list-item-title>
                              </v-list-item-content>
                          </v-list-item>
                      </template>
                      <template v-slot:selection="{ attrs, item, parent, selected }">
                          <div 
                              v-if="limitToSingleCollection"
                              v-bind="attrs" :input-value="selected">
                                  {{ item.description }} ({{ item.id }})
                          </div>
                          <v-chip v-else v-bind="attrs" :input-value="selected" label outlined large>
                              <span class="text-truncate">
                                  {{ item.description }} ({{ item.id }})
                              </span>
                          <span v-show="!loadingCollections && searchingDescription==''" @click.stop="parent.selectItem(item)" class="glyphicon glyphicon-remove-circle"></span>
                          </v-chip>
                      </template>
                      <template v-if="limitToSingleCollection && hasSearches" v-slot:append>
                          <v-slide-x-reverse-transition
                            mode="out-in"
                          >
                            <span
                              :key="`icon-${hasSearches}`"
                              v-show="!loadingCollections && searchingDescription==''"
                              @click="clearMapOfSearches" class="glyphicon glyphicon-remove-circle text-muted"
                            ></span>
                          </v-slide-x-reverse-transition>
                        </template>
              </v-autocomplete>

              <div v-if="!isLoading" class="small text-muted mt-2 my-4">
                  <div v-show="hasSearchesWithouIssues">
                      <span data-toggle="tooltip" data-placement="auto"
                      :title="`Feature options for step #2 have been limited to the collection ${  collectionsSelectedToSearch.length > 1 ? 's' : '' } you selected here.`"
                      class="glyphicon glyphicon-info-sign text-muted">
                      </span>
                      Feature options for step #2 have been limited to the collection {{ collectionsSelectedToSearch.length > 1 ? "s" : "" }} you selected here
                  </div>
                  <div v-show="loadingCollections">
                      <span data-toggle="tooltip" data-placement="auto"
                      title="Loading Geoconnex relations"
                      class="glyphicon glyphicon-info-sign text-muted">
                      </span>
                      Loading Geoconnex relations...
                  </div>
                  <div v-show="searchingDescription">
                      <span data-toggle="tooltip" data-placement="auto"
                      title="Searching Geoconnex"
                      class="glyphicon glyphicon-info-sign text-muted">
                      </span>
                      <b>Searching Geoconnex collection:</b> {{ searchingDescription }}
                  </div>
                  <div v-for="message in collectionMessages">
                      <span data-toggle="tooltip" data-placement="auto"
                          :title="message"
                          class="glyphicon glyphicon-info-sign text-muted">
                      </span>
                      {{ message }}
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
                  hide-no-data
                  allow-overflow="false"
                  chips
                  deletable-chips
                  multiple
                  outlined
                  hide-selected
                  :hide-no-data="!itemTypeahead"
                  :loading="isLoading"
                  label="2. Select related features to add to resource metadata"
                  placeholder="Type to narrow down options or select on the map"
                  :disabled="searchingDescription !==''"
                  :loading="loadingRelations"
                  :search-input.sync="itemTypeahead"
                  :rules="featureRules"
                  return-object="true">
                  <template v-slot:item="data">
                      <template v-if="typeof data.item !== 'object'">
                          <v-list-tile-content v-text="data.item"></v-list-tile-content>
                      </template>
                      <template v-else>
                          <v-list-item-content>
                              <v-list-item-title v-html="data.item.NAME">
                                  <div style="display:none;">{{ data.item.relative_id }}</div>
                                  <!-- Could add data.item.properties to make them searchable -->
                              </v-list-item-title>
                              <v-list-item-subtitle v-html="data.item.relative_id"></v-list-item-subtitle>
                          </v-list-item-content>
                      </template>
                  </template>
                  <template v-slot:no-data>
                      <v-list-item>
                          <v-list-item-content>
                              <v-list-item-title>
                                  No results matching "<strong>{{ itemTypeahead }}</strong>". 
                                  Press <kbd>enter</kbd> to add <v-chip outlined><strong>{{ itemTypeahead }}</strong></v-chip> as a custom item.
                              </v-list-item-title>
                          </v-list-item-content>
                      </v-list-item>
                  </template>
                  <template v-slot:selection="{ attrs, item, parent, selected }">
                      <v-chip v-bind="attrs" :input-value="selected" outlined>
                          <span class="text-truncate" :title="item.text.length > stringLengthLimit ? item.text : ''">
                              {{ item.text }}
                          </span>
                          <span @click.stop="parent.selectItem(item)" class="glyphicon glyphicon-remove-circle"></span>
                      </v-chip>
                  </template>
                  <template v-slot:message="rulesMessage">
                      <div :style="`color: ${featureMessageColor}; margin-left: -12px;`">
                          <span data-toggle="tooltip" data-placement="auto"
                              :title="rulesMessage.message"
                              class="glyphicon glyphicon-info-sign"
                              :style="`color: ${featureMessageColor}`">
                          </span>
                          {{ rulesMessage.message }}
                      </div>
                  </template>
              </v-combobox>
          </div>
          <div v-else class="col-xs-12 col-lg-4 info-table-wrapper" v-if="searchingDescription =='' && selectedReferenceFeatures.length > 0">
              <table class="table hs-table info-table">
                  <tr v-for="value in selectedReferenceFeatures" style="padding-bottom: 20px">
                      <td v-if="isUrl(value.value)" class="dataset-details">
                          <a target="_blank" :href="value.value"> {{value.text}}</a>
                          <i class="fa fa-external-link"></i>
                      </td>
                      <td v-else class="dataset-details">{{value.text}}</td>
                  </tr>
              </table>
          </div>

      <div 
          id="geoconnex-map-wrapper"
          class="col-xs-12 col-lg-8"
          :class="{
              'opaque': !hasSearches && selectedReferenceFeatures.length === 0
          }" >
          <div v-if="resMode === 'Edit'" id="geoconnex-controls" class="flex mb-2">
              <div v-show="!showingMap">
                  <button :loading="searchingDescription" @click="toggleMapVisibility" class="btn btn-default" depressed small>
                      <i class="fa fa-globe"></i>Select With Map
                  </button>
                  <span data-toggle="tooltip" data-placement="auto"
                  title='Shows additional map that you can use to query and view related geospatial features'
                  class="glyphicon glyphicon-info-sign text-muted">
                  </span>
              </div>
              <div v-show="showingMap">
                  <button @click="toggleMapVisibility" class="btn btn-default">
                      <i class="fa fa-minus"></i>Hide Map
                  </button>
              </div>
              <div v-show="showingMap && hasSearches && searchingDescription ==''">
                  <button @click="searchForFeaturesUsingVisibleMapBounds" class="btn btn-info" depressed small>
                      <i class="fa fa-search"></i>Search using visible map bounds
                  </button>
                  <span data-toggle="tooltip" data-placement="auto"
                      title="Search within the visible boundaries of the map, instead of using spatial extent. Zooming in will reduce the search area."
                      class="glyphicon glyphicon-info-sign text-muted"
                  ></span>
              </div>
              <div v-show="!limitToSingleCollection && hasSearches && searchingDescription ==''">
                  <button @click="clearMapOfSearches" class="btn btn-info" depressed small>
                      <i class="fa fa-search-minus"></i>Clear Search
                  </button>
                  <span data-toggle="tooltip" data-placement="auto"
                      title="Clear unselected spatial features"
                      class="glyphicon glyphicon-info-sign text-muted"
                  ></span>
              </div>
          </div>
          <v-progress-linear
              v-show="showingMap"
              :active="true"
              v-if="searchingDescription !==''"
              indeterminate
              :color="collectionSearchColor"
          ></v-progress-linear>
          <div v-show="showingMap" id="geoconnex-leaflet"></div>
          <div v-if="resMode === 'Edit' && showingMap" id="geoconnex-leaflet-info" class="small text-muted">
              <p v-if="searchResultString">Click a point to search for features that overlap with that location.</p>
              <p v-if="features.length > 0">Select a feature for more information.</p>
          </div>
      </div>
    </div>
    <v-table>
      <template v-slot:default>
        <tbody>
          <tr
            v-for="(relation, index) in data.relation"
            :key="`hp-${index}`"
          >
            <td class="">Related Geospatial Feature</td>
            <td>
              <a :href="relation['@id']">{{ relation.name }}</a>
            </td>
          </tr>
        </tbody>
      </template>
    </v-table>
  </v-card>
</template>

<script lang="ts">
import { Component, Vue, toNative, Prop } from "vue-facing-decorator";

@Component({
  name: "geoconnex",
  components: {},
})
class GeoConnex extends Vue {
  @Prop({ type: Object, required: true, default: () => ({}) })
  data!: any;

  @Prop({ type: String, required: false, default: "View" })
  resMode!: string;

  mounted() {
    console.log("GeoConnex component mounted");
  }
}
export default toNative(GeoConnex);
</script>
<style scoped>
#app-geoconnex .flex {
  flex-direction: row;
  /* justify-content: space-between; */
  gap: 2rem;
}

#geoconnex-message-wrapper {
  margin-bottom: 1rem;
}

#app-geoconnex .v-application--wrap {
  min-height: 100px;
}

#app-geoconnex .v-subheader {
  font-size: 1.5rem;
}

#app-geoconnex .v-list-item__subtitle {
  font-size: 1.2rem;
}

#app-geoconnex .v-list-item__title {
  font-size: 1.5rem;
}

#app-geoconnex .glyphicon-remove-circle {
  color: rgb(217, 83, 79);
  cursor: pointer;
}

#app-geoconnex .glyphicon-remove-circle.text-muted {
  color: #999;
}

#geoconnex-controls {
  justify-content: space-between;
  flex-wrap: wrap;
  flex-direction: row;
}

#app-geoconnex .opaque #geoconnex-leaflet {
  opacity: 0.4;
  filter: alpha(opacity=40);
  pointer-events: none;
}

#app-geoconnex .v-chip__content .glyphicon {
  padding: 1rem;
}

#app-geoconnex .tooltip-inner {
  padding: 3px 8px;
  font-weight: normal;
}

#geoconnex-map-wrapper {
  flex: 2 1 500px;
}

#geoconnex-leaflet{
  z-index: 2;
}

#geoconnex-controls-wrapper {
  padding-right: 12px;
  padding-left: 12px;
}

#geoconnex-leaflet {
  height: 400px;
  border: 1px solid #ddd;
  margin-bottom: 1rem;
}

.leaflet-control-container,
.leaflet-popup {
  font-size: 1.2rem !important;
}

#app-geoconnex .dataset-details {
  display: flex;
  gap: 1rem;
  align-items: center;
}

#app-geoconnex .v-application .error--text {
  color: #c09853 !important;
}

/* ******************* BUTTON OVERRIDES ******************* */
#app-geoconnex .v-btn {
  font-size: 1.2rem;
}

.v-application .btn {
  padding: 6px 12px;
  border-style: solid;
  -webkit-box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset;
  -moz-box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset;
}

.v-application .btn i.fa {
  margin-right: 1rem;
}

.v-application .btn-info,
.btn-primary,
.btn-success,
.btn-danger,
.btn-warning {
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
  color: #fff !important;
}

.v-application .btn-success {
  background-color: #eee;
  background-image: -webkit-linear-gradient(#74e274, #5cb85c);
  background-image: linear-gradient(#74e274, #5cb85c);
  border-color: #20833f;
}

.v-application .btn-danger {
  background-color: #d9534f !important;
  /* border-color: #d43f3a  !important; */
  border-color: #8c3c3a !important;
}

.v-application .btn-warning {
  background-color: #f0ad4e;
  border-color: #eea236;
}

.v-application .btn-info {
  background-color: #5bc0de;
  border-color: #46b8da;
}

.v-application .btn-default {
  background-color: #eee;
  background-image: -webkit-linear-gradient(#fcfcfc, #eee);
  background-image: linear-gradient(#fcfcfc, #eee);
}

.v-application .btn-default:not(.active) {
  text-shadow: 1px 1px #fff;
}

#app-geoconnex .btn-primary {
  background-image: linear-gradient(#7ab2e2, #428bca);
  background-color: #eee;
  background-image: -webkit-linear-gradient(#7ab2e2, #428bca);
  background-image: linear-gradient(#7ab2e2, #428bca);
  border-color: #428bca;
}

.v-application .btn-success {
  background-color: #eee;
  background-image: -webkit-linear-gradient(#74e274, #5cb85c);
  background-image: linear-gradient(#74e274, #5cb85c);
  border-color: #20833f;
}

</style>