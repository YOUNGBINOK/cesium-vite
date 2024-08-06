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
let newJson = [];
const searchBar = document.getElementById("search");
const toleranceInput = document.getElementById("tolerance_input");
const exportJson = document.getElementById("export_json");
const pointLength = document.getElementById("point_length");

async function getGeo() {
  try {
    const response = await axios.get("../public/jangan_0.0005.geojson");
    //const response = await axios.get("../public/jangan_0.001.geojson");

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
    newJson = results.filter((result) => result !== null);
    console.log(newJson);
  } catch (error) {
    console.error(error);
  }
}
getGeo();

toleranceInput.value = tolerance;
toleranceInput.addEventListener("change", async function (e) {
  tolerance = Number(e.target.value);
  viewer.entities.removeAll();
  newJson = []; // 변경 시 새로운 데이터를 추가하기 전에 기존 데이터를 초기화

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
  newJson = results.filter((result) => result !== null);
  console.log(newJson);
});

searchBar.addEventListener("change", async function () {
  for (let i = 0; i < geoData.length; i++) {
    const includesGu = geoData[i].properties.CTP_KOR_NM;

    try {
      if (searchBar.value === includesGu) {
        viewer.entities.removeAll();
        newJson = []; // 기존 데이터를 초기화

        let result;
        if (geoData[i].geometry.type === "MultiPolygon") {
          const mergedCoordinates = mergeMultiPolygonCoordinates(
            geoData[i].geometry.coordinates,
          );
          result = await drawLine(mergedCoordinates, geoData[i].properties);
        } else {
          result = await drawLine(
            geoData[i].geometry.coordinates[0],
            geoData[i].properties,
          );
        }

        if (result !== null) {
          newJson.push(result);
        }

        console.log(newJson);
        break;
      }
    } catch (error) {
      console.log(error);
    }
  }
});

async function drawLine(data, properties) {
  try {
    const boundaryCoordinates = [];
    for (let i = 0; i < data.length; i++) {
      boundaryCoordinates.push({ lat: data[i][1], lon: data[i][0] });
    }

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

    pointLength.value = positions.length;

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

    // 새로운 좌표와 속성을 반환
    return {
      type: "Feature",
      properties: properties,
      geometry: {
        type: "Polygon",
        coordinates: [simplifiedCoordinates],
      },
    };
  } catch (error) {
    console.log(error);
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
