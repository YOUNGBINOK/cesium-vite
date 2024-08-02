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
const propertiesData = [];

let properties;
let koreaData;
let newCoord = [];
//let searchBar = document.querySelector(".cesium-geocoder-input");
const searchBar = document.getElementById("search");
const toleranceInput = document.getElementById("tolerance_input");
const exportJson = document.getElementById("export_json");
const pointLength = document.getElementById("point_length");
const newJson = [];
let tolerance = 0.0005;

async function getGeo() {
  try {
    const response = await axios.get("../public/manan.geojson");
    const response2 = await axios.get("../public/korea.geojson");
    koreaData = response2.data.features;
    geoData = response.data[0].geometry.coordinates[0];

    for (let i = 0; i < koreaData.length; i++) {
      propertiesData.push(response2.data.features[i]);
    }

    // 기본 안양시 만안구
    drawLine(geoData);
  } catch (error) {
    console.error(error);
  }
}
getGeo();

toleranceInput.value = tolerance;
toleranceInput.addEventListener("change", function (e) {
  tolerance = e.target.value;
  viewer.entities.removeAll();
  for (let i = 0; i < koreaData.length; i++) {
    const includesGu = koreaData[i].properties.SIG_KOR_NM;

    if (searchBar.value === includesGu) {
      drawLine(koreaData[i].geometry.coordinates[0]);
    }
  }
});

searchBar.addEventListener("change", function () {
  for (let i = 0; i < koreaData.length; i++) {
    const includesGu = koreaData[i].properties.SIG_KOR_NM;
    try {
      if (searchBar.value === includesGu) {
        viewer.entities.removeAll();

        // MultiPolygon일 때 배열 하나로 합치기
        if (koreaData[i].geometry.type === "MultiPolygon") {
          newCoord = [
            koreaData[i].geometry.coordinates[0].flat(),
            koreaData[i].geometry.coordinates[1].flat(),
          ];
          drawLine(newCoord.flat());
        } else {
          drawLine(koreaData[i].geometry.coordinates[0]);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
});

// json 추출
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

async function drawLine(data) {
  // 경계선의 위도와 경도 좌표 (예시 좌표)
  const boundaryCoordinates = [];
  for (let i = 0; i < data.length; i++) {
    boundaryCoordinates.push({ lat: data[i][1], lon: data[i][0] });
  }

  const points = boundaryCoordinates.map((coord) => ({
    x: coord.lon,
    y: coord.lat,
  }));

  const simplifiedPoints = simplify(points, Number(tolerance), true);

  // simplify.js 형식에서 Cesium 형식으로 변환
  const simplifiedCoordinates = simplifiedPoints.map((point) => [
    point.x,
    point.y,
  ]);

  // 경계선을 그리기 위한 좌표 배열 생성
  const positions = simplifiedCoordinates.map((coord) =>
    Cartesian3.fromDegrees(coord[0], coord[1], 400),
  );

  pointLength.value = positions.length;

  for (let i = 0; i < propertiesData.length; i++) {
    const includesGu = propertiesData[i].properties.SIG_KOR_NM;

    if (searchBar.value === includesGu) {
      properties = propertiesData[i].properties;
      newJson.push({
        type: propertiesData[i].type,
        properties: properties,
        geometry: { type: "Polygon", coordinates: [simplifiedCoordinates] },
      });
    }
  }

  // 폴리라인 엔티티 추가
  viewer.entities.add({
    polygon: {
      hierarchy: positions,
      height: 500,
      material: Color.BLUE.withAlpha(0.5),
      outline: true,
      outlineColor: Color.SKYBLUE,
    },
  });

  // 초기 위치 및 줌 설정
  viewer.zoomTo(viewer.entities);
}

createOsmBuildingsAsync().then((buildingTileset) => {
  viewer.scene.primitives.add(buildingTileset);
});
