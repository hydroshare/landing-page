<template>
  <v-container>
    <v-skeleton-loader
      v-if="isFetchingMetadata"
      type="card"
    ></v-skeleton-loader>

    <template v-if="!isFetchingMetadata && wasLoaded">
      <h4 id="overview" class="text-h6 font-weight-medium mb-2">
        {{ data.name }}
      </h4>

      <div
        class="d-flex justify-space-between mb-2 flex-column flex-sm-row align-normal align-sm-end"
      >
        <div v-if="data.creativeWorkStatus || data.dateModified">
          <v-chip
            v-if="data.creativeWorkStatus"
            size="small"
            class="mr-2 bg-primary"
            :color="getStatusColor(data.creativeWorkStatus.name)"
            :title="data.creativeWorkStatus.description"
          >
            {{ data.creativeWorkStatus.name }}
          </v-chip>

          <template v-if="data.dateModified">
            <span class="d-block d-sm-inline" v-bind="infoLabelAttr"
              >Last Updated:
            </span>
            <span v-bind="infoValueAttr">
              {{ parseDate(data.dateModified) }}
              <span class="font-weight-light">
                (<timeago :datetime="data.dateModified" />)
              </span>
            </span>
          </template>
        </div>

        <v-spacer></v-spacer>
        <div class="d-flex gap-1">
          <v-spacer></v-spacer>
          <template v-if="!isLoadingFiles && !isFetchingMetadata">
            <v-menu width="500" :close-on-content-click="false">
              <template v-slot:activator="{ props }">
                <v-btn
                  size="small"
                  v-bind="props"
                  color="primary"
                  prepend-icon="mdi-cog"
                  variant="plain"
                  >Settings</v-btn
                >
              </template>
              <v-card>
                <v-card-title
                  class="bg-grey-lighten-3 text-body-1 text-medium-emphasis"
                  >Settings</v-card-title
                >
                <v-divider></v-divider>
                <v-card-text flat>
                  <s3-form
                    :prefix="s3Info.prefix"
                    :bucket="s3Info.bucket"
                    :s3-host="s3Host"
                    :hydroshare-host="hydroshareHost"
                    :accessKey="accessKey"
                    :secret-key="secretKey"
                    @apply-changes="onS3FormUpdate"
                    @restore-defaults="onRestoreDefaults"
                  ></s3-form>
                </v-card-text>
              </v-card>
            </v-menu>

            <v-btn
              size="small"
              color="primary"
              prepend-icon="mdi-pen"
              variant="outlined"
              @click="$router.push({ name: 'edit-dataset' })"
              >Edit</v-btn
            >
          </template>
        </div>
      </div>
      <v-divider class="my-4"></v-divider>

      <div class="d-flex gap-2">
        <v-container
          class="page-content"
          :class="{ 'is-sm': $vuetify.display.mdAndDown }"
          fluid
        >
          <v-row
            class="mb-4 align-start"
            :no-gutters="$vuetify.display.smAndDown"
          >
            <v-col cols="12" sm="6" class="dataset-info">
              <div v-bind="infoLabelAttr">Created By:</div>

              <div class="infoValueAttr">
                <v-menu
                  v-for="(creator, index) of data.creator"
                  offset-y
                  :close-on-content-click="false"
                  class="d-inline"
                  :key="index"
                >
                  <template v-slot:activator="{ props }">
                    <span
                      class="mr-2 cursor-pointer"
                      v-bind="{ ...props, ...infoValueAttr }"
                    >
                      <div class="d-inline-block">
                        {{ creator.name }} <v-icon small>mdi-menu-down</v-icon>
                      </div>
                    </span>
                  </template>
                  <v-card v-if="creator['type'] == 'Person'" width="auto">
                    <v-card-title class="text-body-1">
                      <v-icon class="mr-2">mdi-account-outline</v-icon>
                      {{ creator.name }}
                    </v-card-title>
                    <v-divider></v-divider>

                    <v-card-text
                      v-if="creator.email || creator.identifier"
                      class="d-flex flex-column gap-1"
                    >
                      <div v-if="creator.email">
                        <div class="d-flex align-center mb-1">
                          <v-icon
                            class="mr-1"
                            small
                            color="secondary"
                            title="Email address"
                            icon="mdi-email-outline"
                          />
                          <div class="d-flex align-center gap-1">
                            <span class="text-medium-emphasis">Email:</span>
                            {{ creator.email }}
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="creator.identifier"
                        class="d-flex align-center"
                      >
                        <i
                          class="fab fa-orcid mr-2 text-secondary text-h6"
                          aria-hidden="true"
                          title="ORCID"
                        ></i>
                        {{ creator.identifier }}
                      </div>

                      <div v-if="creator.affiliation">
                        <div class="d-flex align-center mb-1">
                          <v-icon
                            small
                            color="secondary"
                            class="mr-1"
                            title="Affiliation"
                          >
                            mdi-domain
                          </v-icon>
                          <div class="d-flex align-center gap-1">
                            <span class="text-medium-emphasis"
                              >Affiliation:</span
                            >
                            <div v-if="creator.affiliation.name">
                              <span
                                v-if="creator.affiliation.url"
                                class="d-inline-flex align-baseline"
                              >
                                <a :href="creator.affiliation.url">{{
                                  creator.affiliation.name
                                }}</a>
                              </span>
                              <span v-else>{{ creator.affiliation.name }}</span>
                            </div>
                          </div>
                        </div>

                        <div v-if="creator.affiliation.address">
                          {{ creator.affiliation.address }}
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-menu>
              </div>

              <template v-if="data.provider">
                <div v-bind="infoLabelAttr">Provider:</div>
                <div v-bind="infoValueAttr">
                  <span v-if="data.provider.url" class="d-flex align-baseline">
                    <a :href="data.provider.url">{{ data.provider.name }}</a>
                  </span>

                  <template v-else>{{ data.provider.name }}</template>
                </div>
              </template>

              <template v-if="data.publisher">
                <div v-bind="infoLabelAttr">Publisher:</div>
                <div v-bind="infoValueAttr">
                  <span v-if="data.publisher.url" class="d-flex align-baseline">
                    <a :href="data.publisher.url">{{ data.publisher.name }}</a>
                  </span>

                  <template v-else>{{ data.publisher.name }}</template>
                </div>
              </template>

              <div v-bind="infoLabelAttr">Resource Type:</div>
              <div v-bind="infoValueAttr">{{ data["@type"] }}</div>

              <template v-if="contentSize">
                <div v-bind="infoLabelAttr">Resource Size:</div>
                <div v-bind="infoValueAttr">~{{ contentSize }}</div>
              </template>

              <div v-bind="infoLabelAttr">License:</div>
              <div v-bind="infoValueAttr">
                <div v-if="data.license?.url" class="d-flex align-baseline">
                  <a :href="data.license?.url">{{ data.license?.name }}</a>
                </div>

                <template v-else>{{ data.license?.name }}</template>

                <div class="font-weight-light text-subtitle-2">
                  {{ data.license?.description }}
                </div>
              </div>

              <template v-if="data.inLanguage">
                <div v-bind="infoLabelAttr">Language:</div>
                <div v-bind="infoValueAttr">{{ data.inLanguage }}</div>
              </template>

              <template v-if="data.version">
                <div v-bind="infoLabelAttr">Version:</div>
                <div v-bind="infoValueAttr">{{ data.version }}</div>
              </template>
            </v-col>

            <v-col cols="12" sm="6" class="dataset-info">
              <div v-bind="infoLabelAttr">Created:</div>
              <div v-bind="infoValueAttr">
                {{ parseDate(data.dateCreated) }}
              </div>

              <template v-if="data.datePublished">
                <div v-bind="infoLabelAttr">Published:</div>
                <div v-bind="infoValueAttr">
                  {{ parseDate(data.datePublished) }}
                </div>
              </template>

              <div v-bind="infoLabelAttr">Views:</div>
              <div v-bind="infoValueAttr">3784</div>

              <div v-bind="infoLabelAttr">Downloads:</div>
              <div v-bind="infoValueAttr">46</div>
            </v-col>
          </v-row>

          <div class="mb-8 field" id="description">
            <div v-bind="headingAttr">Abstract</div>
            <v-divider class="mb-2"></v-divider>
            <!-- <p class="text-body-1 text-medium-emphasis">{{ data.description }}</p> -->
            <v-banner
              :text="data.description"
              :lines="showDescription ? undefined : 'three'"
              stacked
              class="pa-0 pb-4"
              :border="0"
            >
              <template v-slot:actions>
                <v-btn
                  @click="showDescription = !showDescription"
                  size="x-small"
                  >{{ showDescription ? "Show less" : "Show more" }}</v-btn
                >
              </template>

              <template #text
                ><div class="text-body-1 text-medium-emphasis">
                  {{ data.description }}
                </div></template
              >
            </v-banner>
          </div>

          <div class="my-4 field" id="subject">
            <div v-bind="headingAttr">Subject Keywords</div>
            <v-divider class="mb-2"></v-divider>
            <v-chip
              v-for="keyword of data.keywords"
              :key="keyword"
              size="small"
              style="margin: 0.25rem"
              variant="outlined"
              class="bg-grey-lighten-5"
              border="thin"
              >{{ keyword }}</v-chip
            >
          </div>

          <div
            v-if="
              data.document[0].associatedMedia &&
              data.document[0].associatedMedia.length
            "
            class="mb-8 field"
            id="content"
          >
            <div v-bind="headingAttr">Content</div>
            <v-divider class="mb-2"></v-divider>

            <cz-file-explorer
              @showMetadata="onShowMetadata($event)"
              id="fileExplorer"
              class="ma-4"
              v-if="!isLoadingFiles"
              ref="fileExplorer"
              :root-directory="rootDirectory"
              :has-folders="fileExplorerConfig.hasFolders"
              :is-read-only="true"
              :has-file-metadata="() => true"
              :canDownloadItem="() => true"
              @download="
                onFileDownload($event, resourceId, s3Client, s3Info.bucket)
              "
            >
              <template #prepend>
                <span />
              </template>
            </cz-file-explorer>
            <!-- <v-skeleton-loader
            class="mb-12"
            v-else
            type="card"
          ></v-skeleton-loader> -->

            <v-card
              v-if="readmeMd || isLoadingMD"
              id="readme"
              class="readme-container mx-4"
              variant="outlined"
              border="grey thin"
            >
              <v-card-title class="text-overline d-flex gap-2"
                ><div>README</div>
                <div class="text-caption text-medium-emphasis">
                  {{ readMeFileName }}
                </div></v-card-title
              >

              <v-divider></v-divider>
              <v-card-text>
                <div class="text-center py-4" v-if="isLoadingMD">
                  <v-progress-circular
                    indeterminate
                    class="text-center"
                    color="primary"
                  />
                </div>
                <div
                  v-if="!hasTxtReadme"
                  v-html="readmeMd"
                  class="markdown-body px-4"
                ></div>
                <pre v-else class="px-4" style="white-space: pre-wrap">{{
                  readmeMd
                }}</pre>
              </v-card-text>
            </v-card>
          </div>

          <div
            v-if="data.funding && data.funding.length"
            class="mb-8 field"
            id="funding"
          >
            <div v-bind="headingAttr">Funding</div>
            <v-divider class="mb-2"></v-divider>
            <p class="text-body-2 text-medium-emphasis mb-4">
              This resource was created using funding from the following
              sources:
            </p>
            <v-expansion-panels multiple elevation="1">
              <v-expansion-panel
                v-for="(funding, index) of data.funding"
                :key="index"
                :readonly="!(funding.description || funding.funder)"
              >
                <v-expansion-panel-title class="bg-grey-lighten-5">
                  <div>
                    <div class="text-body-2">{{ funding.name }}</div>

                    <div
                      v-if="funding.identifier"
                      class="text-body-2 font-weight-light"
                    >
                      Award number: {{ funding.identifier }}
                    </div>
                  </div>

                  <template
                    v-slot:actions
                    v-if="!(funding.description || !!funding.funder)"
                    ><span></span
                  ></template>
                </v-expansion-panel-title>
                <v-divider></v-divider>

                <v-expansion-panel-text
                  v-if="funding.description || !!funding.funder"
                >
                  <div
                    class="pt-2 text-body-2 font-weight-light"
                    v-if="funding.description"
                  >
                    {{ funding.description }}
                  </div>
                  <template v-if="!!funding.funder">
                    <div class="d-flex align-center text-body-1 mt-4 mb-2">
                      <v-icon class="mr-2"> mdi-domain </v-icon>
                      <div class="text-body-2 text-medium-emphasis">
                        Funding Organization:
                      </div>
                    </div>
                    <div class="text-body-2">
                      <div>
                        {{ funding.funder.name }}
                      </div>
                      <div>{{ funding.funder.address }}</div>
                      <a :href="funding.funder.url"
                        >{{ funding.funder.url }}
                      </a>
                    </div>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <div
            v-if="
              data.hasPart?.length ||
              data.isPartOf?.length ||
              data.subjectOf?.length
            "
            class="mb-8 field"
            id="related"
          >
            <div v-bind="headingAttr">Related Resources</div>
            <v-divider class="mb-2"></v-divider>
            <v-card variant="outlined" border="grey thin">
              <v-table>
                <template v-slot:default>
                  <tbody>
                    <tr
                      v-for="(part, index) in data.hasPart"
                      :key="`hp-${index}`"
                    >
                      <td class="">Has part</td>
                      <td>
                        <a :href="part.url">{{ part.name }}</a>
                      </td>
                    </tr>

                    <tr
                      v-for="(part, index) in data.isPartOf"
                      :key="`hp-${index}`"
                    >
                      <td class="">Is part of</td>
                      <td>
                        <a :href="part.url">{{ part.name }}</a>
                      </td>
                    </tr>

                    <tr
                      v-for="(part, index) in data.subjectOf"
                      :key="`hp-${index}`"
                    >
                      <td class="">Subject of</td>
                      <td>
                        <a :href="part.url">{{ part.name }}</a>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </v-table>
            </v-card>
          </div>

          <div
            v-if="
              data.relation?.length
            "
            class="mb-8 field"
            id="relatedGeospatial"
          >
            <div v-bind="headingAttr">Related Geospatial Features</div>
            <v-divider class="mb-2"></v-divider>
            <geoconnex :jsonData="data" resMode="View" />
          </div>

          <div
            v-if="hasSpatialFeatures && $vuetify.display.mdAndDown"
            class="my-4 field text-body-1"
            id="coverage"
          >
            <div class="text-overline primary--text darken-4">
              Spatial Coverage
            </div>

            <v-divider class="primary mb-2"></v-divider>
            <v-row>
              <v-col cols="12" sm="8">
                <v-card variant="outlined" border="grey thin">
                  <cd-spatial-coverage-map :feature="data.spatialCoverage" />
                  <v-divider></v-divider>
                  <v-card-text
                    v-if="data.spatialCoverage.geo['type'] == 'GeoShape'"
                  >
                    <v-row class="align-start">
                      <v-col cols="12" sm="6" class="dataset-info">
                        <div v-bind="infoLabelAttr">North Latitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ boxCoordinates.north }}°
                        </div>

                        <div v-bind="infoLabelAttr">East Longitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ boxCoordinates.east }}°
                        </div>
                      </v-col>
                      <v-col cols="12" sm="6" class="dataset-info">
                        <div v-bind="infoLabelAttr">South Latitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ boxCoordinates.south }}°
                        </div>

                        <div v-bind="infoLabelAttr">West Longitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ boxCoordinates.west }}°
                        </div>
                      </v-col>
                    </v-row>
                  </v-card-text>

                  <v-card-text
                    v-if="data.spatialCoverage.geo['type'] == 'GeoCoordinates'"
                  >
                    <v-row class="align-start">
                      <v-col cols="12" sm="6" class="dataset-info">
                        <div v-bind="infoLabelAttr">Latitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ data.spatialCoverage.geo.latitude }}°
                        </div>
                      </v-col>

                      <v-col cols="12" sm="6" class="dataset-info">
                        <div v-bind="infoLabelAttr">Longitude:</div>
                        <div v-bind="infoValueAttr">
                          {{ data.spatialCoverage.geo.longitude }}°
                        </div>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="4" class="dataset-info one-col">
                <div v-bind="infoLabelAttr">
                  Coordinate System/Geographic Projection:
                </div>
                <div v-bind="infoValueAttr">WGS 84 EPSG:4326</div>

                <div v-bind="infoLabelAttr">Coordinate Units:</div>
                <div v-bind="infoValueAttr">Decimal degrees</div>

                <div v-bind="infoLabelAttr">Place/Area Name:</div>
                <div v-bind="infoValueAttr">
                  {{ data.spatialCoverage.name }}
                </div>
              </v-col>
            </v-row>
          </div>

          <div
            v-if="data.temporalCoverage && $vuetify.display.mdAndDown"
            class="mb-8 field text-body-1"
          >
            <div class="text-overline primary--text darken-4">
              Temporal Coverage
            </div>
            <v-divider class="primary mb-2"></v-divider>

            <v-timeline align-top density="compact" line-color="info">
              <v-timeline-item dot-color="primary">
                <div>
                  <div class="font-weight-normal">
                    <strong>Start Date</strong>
                  </div>
                  <div>{{ parseDate(data.temporalCoverage.startDate) }}</div>
                </div>
              </v-timeline-item>

              <v-timeline-item dot-color="orange">
                <div>
                  <div class="font-weight-normal">
                    <strong>End Date</strong>
                  </div>
                  <div>{{ parseDate(data.temporalCoverage.endDate) }}</div>
                </div>
              </v-timeline-item>
            </v-timeline>
          </div>
        </v-container>

        <div v-if="!$vuetify.display.mdAndDown" class="sidebar break-word">
          <div>
            <v-card
              v-if="hasSpatialFeatures"
              variant="outlined"
              border="grey thin"
            >
              <v-card-title class="text-overline">
                Spatial Coverage
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text flat class="pa-0">
                <cd-spatial-coverage-map :feature="data.spatialCoverage" />
              </v-card-text>
              <v-divider></v-divider>
              <v-expansion-panels accordion flat>
                <v-expansion-panel>
                  <v-expansion-panel-title color="text-overline">
                    Extent
                  </v-expansion-panel-title>

                  <v-expansion-panel-text>
                    <v-card-text
                      v-if="data.spatialCoverage.geo['type'] == 'GeoShape'"
                    >
                      <v-row class="align-start">
                        <v-col cols="12" class="dataset-info pa-0">
                          <div v-bind="infoLabelAttr">North Latitude:</div>
                          <div v-bind="infoValueAttr" class="text-right">
                            {{ boxCoordinates.north }}°
                          </div>

                          <div v-bind="infoLabelAttr">East Longitude:</div>
                          <div v-bind="infoValueAttr" class="text-right">
                            {{ boxCoordinates.east }}°
                          </div>

                          <div v-bind="infoLabelAttr">South Latitude:</div>
                          <div v-bind="infoValueAttr" class="text-right">
                            {{ boxCoordinates.south }}°
                          </div>

                          <div v-bind="infoLabelAttr">West Longitude:</div>
                          <div v-bind="infoValueAttr" class="text-right">
                            {{ boxCoordinates.west }}°
                          </div>
                        </v-col>
                      </v-row>
                    </v-card-text>

                    <v-card-text
                      v-if="
                        data.spatialCoverage.geo['type'] == 'GeoCoordinates'
                      "
                    >
                      <v-row class="align-start">
                        <v-col cols="12" class="dataset-info">
                          <div v-bind="infoLabelAttr">Latitude:</div>
                          <div v-bind="infoValueAttr">
                            {{ data.spatialCoverage.geo.latitude }}°
                          </div>
                        </v-col>

                        <v-col cols="12" class="dataset-info">
                          <div v-bind="infoLabelAttr">Longitude:</div>
                          <div v-bind="infoValueAttr">
                            {{ data.spatialCoverage.geo.longitude }}°
                          </div>
                        </v-col>
                      </v-row>
                    </v-card-text>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <v-expansion-panel>
                  <v-expansion-panel-title color="text-overline">
                    Coordinate System
                  </v-expansion-panel-title>

                  <v-expansion-panel-text>
                    <v-card-text class="dataset-info one-col pa-0">
                      <div v-bind="infoLabelAttr">
                        Coordinate System/Geographic Projection:
                      </div>
                      <div v-bind="infoValueAttr">WGS 84 EPSG:4326</div>

                      <div v-bind="infoLabelAttr">Coordinate Units:</div>
                      <div v-bind="infoValueAttr">Decimal degrees</div>

                      <div v-bind="infoLabelAttr">Place/Area Name:</div>
                      <div v-bind="infoValueAttr">
                        {{ data.spatialCoverage.name }}
                      </div>
                    </v-card-text>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card>

            <v-card
              v-if="data.temporalCoverage"
              class="mt-8"
              variant="outlined"
              border="grey thin"
            >
              <v-card-title class="text-overline primary--text darken-4">
                Temporal Coverage
              </v-card-title>
              <v-divider></v-divider>

              <v-card-text>
                <v-timeline align-top density="compact" line-color="info">
                  <v-timeline-item
                    dot-color="primary"
                    icon="mdi-calendar"
                    fill-dot
                  >
                    <div>
                      <strong>Start Date</strong>
                      <div>
                        {{ parseDate(data.temporalCoverage.startDate) }}
                      </div>
                    </div>
                  </v-timeline-item>

                  <v-timeline-item
                    dot-color="orange-darken-2"
                    icon="mdi-calendar"
                    fill-dot
                  >
                    <div>
                      <strong>End Date</strong>
                      <div>{{ parseDate(data.temporalCoverage.endDate) }}</div>
                    </div>
                  </v-timeline-item>
                </v-timeline>
              </v-card-text>
            </v-card>

            <v-card
              v-if="
                data.document[0].citation && data.document[0].citation.length
              "
              class="mt-8"
              variant="flat"
              id="citation"
            >
              <v-card-title class="pa-0 pb-2">How to cite</v-card-title>
              <v-card-text
                v-for="(citation, index) of data.document[0].citation"
                :key="index"
                class="pa-0 text-body-2 text-medium-emphasis"
              >
                <div class="d-flex align-center justify-space-between gap-1">
                  <div class="citation-text">
                    {{ citation }}
                  </div>

                  <v-tooltip bottom>
                    <template v-slot:activator="{ props }">
                      <v-btn icon v-bind="props" @click="onCopy(citation)">
                        <v-icon dark> mdi-content-copy </v-icon>
                      </v-btn>
                    </template>
                    <span>Copy</span>
                  </v-tooltip>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </div>
      </div>
    </template>

    <v-empty-state
      v-if="!wasLoaded"
      icon="mdi-cloud-cancel"
      text="Try adjusting your settings."
      title="We couldn't load this resource."
    ></v-empty-state>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref } from "vue-facing-decorator";
import {
  CzForm,
  CzFileExplorer,
  Notifications,
} from "@cznethub/cznet-vue-core";
import type { IFolder } from "@cznethub/cznet-vue-core/dist/types";
import { S3Client, _Object } from "@aws-sdk/client-s3";
import { stringify } from "@/utils";
import { fetchResource, onFileDownload } from "./shared";
import S3Form from "./s3-form.vue";
import User from "@/models/user.model";
import { sizeToBytes } from "@/util";
import prettyBytes from "pretty-bytes";
import { useGoTo } from "vuetify";
import { EnumCreativeWorkStatus } from "@/types";
import markdownit from "markdown-it";

import CdSpatialCoverageMap from "@/components/search-results/cd.spatial-coverage-map.vue";
import Geoconnex from "@/components/geoconnex.vue";

const md = markdownit({
  linkify: true,
  typographer: true,
  breaks: true,
  html: true,
});

@Component({
  components: { CzForm, CzFileExplorer, S3Form, CdSpatialCoverageMap },
  name: "App",
})
class LandingPage extends Vue {
  resourceId!: string;

  @Ref("form") form!: InstanceType<typeof CzForm>;
  @Ref("fileExplorer") fileExplorer!: InstanceType<typeof CzFileExplorer>;

  protected get isLoggedIn(): boolean {
    return User.$state.isLoggedIn;
  }

  showDescription = false;
  readmeMd = "";
  readMeFileName = "";
  hasTxtReadme = false;
  isLoadingMD = false;

  schema!: any;
  uischema!: any;
  onFileDownload = onFileDownload;

  data: Record<string, any> = {};
  stringify = stringify;

  accessKey = localStorage.getItem("s3AccessKey") || "cuahsi";
  secretKey = localStorage.getItem("s3SecretKey") || "devpassword";

  isLoadingFiles: boolean = true;
  currentPath: string = "";
  isFetchingMetadata = true;
  wasLoaded = true;

  s3Client!: S3Client;
  s3Host: string = "https://s3.beta.hydroshare.org";
  hydroshareHost: string = "https://beta.hydroshare.org";

  s3Info = {
    bucket: "",
    prefix: "",
  };

  config = {
    restrict: true,
    trim: true,
    showUnfocusedDescription: false,
    hideRequiredAsterisk: false,
    collapseNewItems: false,
    breakHorizontal: false,
    initCollapsed: false,
    hideAvatar: false,
    hideArraySummaryValidation: false,
    vuetify: {
      commonAttrs: {
        density: "compact",
        variant: "outlined",
        "persistent-hint": true,
        "hide-details": false,
      },
    },
    isViewMode: true,
    isReadOnly: false,
    isDisabled: false,
  };

  rootDirectory: Partial<IFolder> = {
    name: "root",
    children: [],
  };
  fileExplorerConfig = {
    isReadOnly: true, // Unused for now
    hasFolders: true,
  };

  startS3Client() {
    this.s3Client = new S3Client({
      region: "us-central-2",
      endpoint: this.s3Host,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
    });
  }
  infoLabelAttr = {
    class: "text-subtitle-2 font-weight-medium",
  };
  selectedMetadata: any = false;
  showMetadata = false;

  infoValueAttr = {
    class: "text-body-2 mb-2 text-medium-emphasis",
  };
  headingAttr = {
    class: "text-teal-lighten-2 font-weight-medium text-h6 mb-2",
  };
  scrollOptions = {
    offset: -80,
    easing: "easeInOutCubic",
  };
  goTo = useGoTo();

  onShowMetadata(item: any) {
    this.selectedMetadata = item;
    this.showMetadata = true;
  }

  onCopy(text: string) {
    navigator.clipboard.writeText(text);
    Notifications.toast({ message: "Copied to clipboard", type: "info" });
  }

  async loadReadmeFile() {
    // TODO: get from files loaded
    const readmeFile = this.data.document[0].associatedMedia?.find(
      (f: any) =>
        f.name.toLowerCase() === "readme.md" ||
        f.name.toLowerCase() === "readme.txt",
    );

    if (readmeFile?.contentUrl) {
      this.readMeFileName = readmeFile.name;
      if (readmeFile.name.toLowerCase() === "readme.txt") {
        this.hasTxtReadme = true;
      }
      const url = readmeFile.contentUrl.replace("http:", "https:");
      try {
        this.isLoadingMD = true;
        const response = await fetch(url);
        const rawMd = await response.text();
        if (!this.hasTxtReadme) {
          this.readmeMd = md.render(rawMd);
        } else {
          // simple text viewer
          this.readmeMd = rawMd;
        }
      } catch (e) {
        console.log(e);
      } finally {
        this.isLoadingMD = false;
      }
    }
  }

  get hasSpatialFeatures(): boolean {
    const feat = this.data.spatialCoverage?.["type"];
    return feat === "GeoShape" || feat === "GeoCoordinates" || feat === "Place";
  }

  get contentSize() {
    let total = 0;

    if (this.data.document[0].associatedMedia?.length) {
      total = this.data.document[0].associatedMedia.reduce(
        (acc: number, m: any, _index: number) => {
          let size = 0;

          if (typeof m.contentSize === "string") {
            size = sizeToBytes(m.contentSize);
          } else if (typeof m.size === "number") {
            size = m.size;
          }

          acc += size;
          return acc;
        },
        0,
      );
    }
    return prettyBytes(total);
  }

  get boxCoordinates() {
    const extents = this.data.spatialCoverage.geo.box
      .trim()
      .split(" ")
      .map((n: string) => +n);
    return {
      north: extents[0],
      east: extents[1],
      south: extents[2],
      west: extents[3],
    };
  }

  async created() {
    if (!this.resourceId && this.$route?.params?.resourceId) {
      this.resourceId = this.$route.params.resourceId as string;
    }

    // notify if the resourceId is not set
    if (!this.resourceId) {
      alert(
        "No resourceId provided. Using example resourceId: d7b526e24f7e449098b428ae9363f514.",
      );
      this.$router.push({
        name: "landing",
        params: { resourceId: "d7b526e24f7e449098b428ae9363f514" },
      });
    }

    // https://cuahsi.atlassian.net/browse/CAM-769
    // TODO: for now we store access and secret keys in localStorage
    // Replace when we update to Pinia

    const fetchCredentials = async () => {
      const { access_key, secret_key } = await User.getOrCreateS3Credentials();
      this.accessKey = access_key;
      this.secretKey = secret_key;
    };

    if (this.isLoggedIn) {
      console.log("user is already logged in, fetching S3 credentials");
      fetchCredentials();
    } else {
      console.log(
        "checking if we just returned from HydroShare login redirect",
      );
      User.checkLoginStatus().then((loggedIn) => {
        if (loggedIn) {
          fetchCredentials();
        }
      });
    }

    if (!this.accessKey || !this.secretKey) {
      this.accessKey = prompt("Enter your S3 Access Key:") || "cuahsi";
      this.secretKey = prompt("Enter your S3 Secret Key:") || "devpassword";

      if (this.accessKey && this.secretKey) {
        localStorage.setItem("s3AccessKey", this.accessKey);
        localStorage.setItem("s3SecretKey", this.secretKey);
      } else {
        alert("Access key and secret key are required to proceed.");
        return;
      }
    }

    if (!this.s3Info.bucket || !this.s3Info.prefix) {
      try {
        const s3info = await User.getResourceS3prefix(this.resourceId);
        if (s3info) {
          this.s3Info = s3info;
          this.s3Info.prefix = `md/${this.resourceId}/`; // TODO: overriding wrong api response value
        }
      } catch (e) {
        this.isLoadingFiles = false;
        this.isFetchingMetadata = false;
      }
    }

    this.startS3Client();

    /* @ts-ignore */
    this.schema = await import(
      `@/schemas/hydroshare/scientific_dataset_json_schema.json`
    );

    /* @ts-ignore */
    this.uischema = await import(`@/schemas/hydroshare/view-uischema.json`);

    this.loadResource();
  }

  parseDate(date: string): string {
    const parsed = new Date(Date.parse(date));
    return parsed.toLocaleString("default", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  getStatusColor(status: EnumCreativeWorkStatus) {
    switch (status) {
      case EnumCreativeWorkStatus.Draft:
        return "primary";
      case EnumCreativeWorkStatus.Incomplete:
        return "red";
      case EnumCreativeWorkStatus.Obsolete:
        return "orange";
      case EnumCreativeWorkStatus.Published:
        return "green";
      default:
        "primary";
    }
  }

  beforeUnmount() {
    User.$state.toc = [];
  }

  async loadResource() {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.wasLoaded = true;
    User.$state.toc = [];

    const resource = await fetchResource(
      this.resourceId,
      this.s3Client,
      this.s3Info.bucket,
      `${this.s3Info.prefix}dataset_metadata.json`,
    );

    // TODO: bypassing to use mock resource
    if (resource || true) {
      // this.data = resource.data;
      this.data = {
        ...this.data,
        ...mockResource,
      };
      // @ts-expect-error The key property is generated when the component is initialized
      this.rootDirectory.children = resource.initialStructure || [];
      this.loadReadmeFile();
    } else {
      this.wasLoaded = false;
    }
    this.isFetchingMetadata = false;
    this.isLoadingFiles = false;
    User.$state.toc = [
      { text: "Overview", to: "#overview" },
      {
        text: "Abstract",
        to: "#description",
        // isShown: (data: any) => !!data.description || false,
      },
      {
        text: "Subject Keywords",
        to: "#subject",
        // isShown: (data: any) => data.keywords?.length || false,
      },
      {
        text: "Content",
        to: "#content",
        // isShown: (data: any) => data.associatedMedia?.length || false,
      },
      {
        text: "Files",
        to: "#fileExplorer",
        level: 4,
        // isShown: (data: any) => data.associatedMedia?.length || false,
      },
      {
        text: "README",
        to: "#readme",
        level: 4,
        // isShown: (data: any) => data.associatedMedia?.length || false,
      },
      {
        text: "Funding",
        to: "#funding",
        // isShown: (data: any) => data.funding?.length || false,
      },
      {
        text: "Related Resources",
        to: "#related",
        // isShown: (data: any) => data.hasPart?.length || false,
      },
      {
        text: "Related Geospatial Features",
        to: "#relatedGeospatial",
        // isShown: (data: any) => data.relation?.length || false,
      },
      // {
      //   text: "Spatial Coverage",
      //   to: "#spatial-coverage",
      //   // isShown: (data: any) => {
      //   //   const feat = data.spatialCoverage?.["type"];
      //   //   const hasSpatialFeatures =
      //   //     feat === "GeoShape" ||
      //   //     feat === "GeoCoordinates" ||
      //   //     feat === "Place";
      //   //   return !!hasSpatialFeatures || false;
      //   // },
      // },
      // {
      //   text: "Temporal Coverage",
      //   to: "#temporal-coverage",
      //   // isShown: (data: any) => data.temporalCoverage || false,
      // },
    ];
  }

  async onS3FormUpdate(params: any) {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.s3Info.bucket = params.bucket;
    this.s3Info.prefix = params.prefix;
    this.hydroshareHost = params.hydroshareHost;
    this.s3Host = params.s3Host;

    this.secretKey = params.secretKey;
    this.accessKey = params.accessKey;
    localStorage.setItem("s3AccessKey", this.accessKey);
    localStorage.setItem("s3SecretKey", this.secretKey);

    this.startS3Client();
    this.loadResource();
  }

  async onRestoreDefaults() {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.s3Host = "https://s3.beta.hydroshare.org";
    this.hydroshareHost = "https://beta.hydroshare.org";

    try {
      User.getResourceS3prefix(this.resourceId).then((s3info) => {
        if (s3info) {
          this.s3Info = s3info;
          this.s3Info.prefix = `md/${this.resourceId}/`; // TODO: overriding wrong api response value
        }
      });
      this.startS3Client();
      this.loadResource();
    } catch (e) {
      this.isLoadingFiles = false;
      this.isFetchingMetadata = false;
    }
  }
}
export default toNative(LandingPage);
</script>

<style lang="scss" scoped>
.sidebar {
  flex-basis: 25rem;
  flex-shrink: 0;
  min-width: 0;
}

.page-content {
  flex-grow: 1;
  max-width: 100%;
  min-width: 0;

  &.is-sm {
    .dataset-info {
      grid-template-columns: auto;
      gap: 0;
    }
  }
}

:deep(.map-container) {
  height: 15rem;
}

.citation-text {
  min-width: 0;
  word-break: break-word;
}

#graph-container {
  width: 600px;
  height: 400px;
  border: 1px solid #ddd;
}

.dataset-info {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0rem 1rem;
  justify-content: start;
  align-items: baseline;
  align-content: baseline;

  &.one-col {
    grid-template-columns: 1fr;
  }
}

:deep(#fileExplorer .v-sheet) {
  background-color: #f6f6f6 !important;
}

.readme-container {
  .v-card-text {
    min-height: 5rem;
    height: 20rem;
    overflow: auto;
    resize: vertical;
  }

  .markdown-body {
    box-sizing: border-box;
    min-width: 200px;
    max-width: 980px;
    padding: 45px;
    font-family: inherit;
  }

  @media (max-width: 767px) {
    .markdown-body {
      padding: 15px;
    }
  }
}
</style>
