import {
  Cartesian3,
  Terrain,
  Viewer,
  Color,
  createOsmBuildingsAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";
import axios from "axios";
import simplify from "simplify-js";

const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
});

let geoData;
let tolerance = 0.0005;
const newJson = {
  type: "FeatureCollection",
  features: [],
};
let pointNum = 0;
const toleranceInput = document.getElementById("tolerance_input");
const exportJson = document.getElementById("export_json");
const pointLength = document.getElementById("point_length");

async function getGeo() {
  try {
    const response = await axios.get("../public/seoul_gyeongi_2.geojson");
    geoData = response.data.features;

    const promises = geoData.map(async (feature) => {
      if (feature.geometry.type === "MultiPolygon") {
        const mergedCoordinates = mergeMultiPolygonCoordinates(
          feature.geometry.coordinates,
        );
        await drawLine(mergedCoordinates, feature.properties);
      } else {
        await drawLine(feature.geometry.coordinates[0], feature.properties);
      }
    });

    const results = await Promise.all(promises);
    newJson.features = results.filter((result) => result !== null);
  } catch (error) {
    console.error("Error fetching GeoJSON data:", error);
  }
}
getGeo();

toleranceInput.value = tolerance;
toleranceInput.addEventListener("change", async function (e) {
  tolerance = Number(e.target.value);
  viewer.entities.removeAll();
  newJson.features = [];
  pointNum = 0;

  const promises = geoData.map(async (feature) => {
    if (feature.geometry.type === "MultiPolygon") {
      const mergedCoordinates = mergeMultiPolygonCoordinates(
        feature.geometry.coordinates,
      );
      await drawLine(mergedCoordinates, feature.properties);
    } else {
      await drawLine(feature.geometry.coordinates[0], feature.properties);
    }
  });

  const results = await Promise.all(promises);
  newJson.features = results.filter((result) => result !== null);
  console.log("Updated GeoJSON data:", newJson);
});

async function drawLine(data, properties) {
  try {
    if (!data || data.length === 0) {
      console.error("Invalid or empty coordinate data.");
      return null;
    }

    const boundaryCoordinates = data.map((coord) => ({
      lat: coord[1],
      lon: coord[0],
    }));

    const points = boundaryCoordinates.map((coord) => ({
      x: coord.lon,
      y: coord.lat,
    }));

    const simplifiedPoints = simplify(points, tolerance, true);

    const simplifiedCoordinates = simplifiedPoints.map((point) => [
      point.x,
      point.y,
    ]);

    const positions = simplifiedCoordinates.map((coord) =>
      Cartesian3.fromDegrees(coord[0], coord[1], 400),
    );
    pointNum += positions.length;
    pointLength.value = pointNum;

    console.log(properties.SGG_NM, boundaryCoordinates.length);
    viewer.entities.add({
      polygon: {
        hierarchy: positions,
        height: 3000,
        material: Color.BLUE.withAlpha(0.5),
        outline: true,
        outlineColor: Color.SKYBLUE,
      },
    });

    viewer.zoomTo(viewer.entities);

    return {
      type: "Feature",
      properties: properties,
      geometry: {
        type: "Polygon",
        coordinates: [simplifiedCoordinates],
      },
    };
  } catch (error) {
    console.error("Error drawing line:", error);
    return null;
  }
}

function mergeMultiPolygonCoordinates(coordinates) {
  const merged = [];
  for (let i = 0; i < coordinates.length; i++) {
    for (let j = 0; j < coordinates[i].length; j++) {
      merged.push(...coordinates[i][j]);
    }
  }
  return merged;
}

exportJson.addEventListener("click", function () {
  const filename = "data.geojson";
  const jsonStr = JSON.stringify(newJson);

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    `data:text/plain;charset=utf-8,${encodeURIComponent(jsonStr)}`,
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();
});

createOsmBuildingsAsync().then((buildingTileset) => {
  viewer.scene.primitives.add(buildingTileset);
});
