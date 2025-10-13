<template>
  <v-card variant="outlined" border="grey thin">
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

  mounted() {
    console.log("GeoConnex component mounted");
  }
}
export default toNative(GeoConnex);
</script>