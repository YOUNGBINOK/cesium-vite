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
let propertiesData;
const toleranceInput = document.getElementById("tolerance_input");
const exportJson = document.getElementById("export_json");
const pointLength = document.getElementById("point_length");
const newJson = [];
let tolerance = 0.0005;

async function getGeo() {
  try {
    const response = await axios.get("../public/manan.geojson");
    geoData = response.data[0].geometry.coordinates[0];
    propertiesData = response.data[0];
    console.log(response.data[0]);

    drawLine();
  } catch (error) {
    console.error(error);
  }
}
getGeo();

toleranceInput.value = tolerance;
toleranceInput.addEventListener("change", function (e) {
  tolerance = e.target.value;
  viewer.entities.removeAll();
  drawLine();
});

async function drawLine() {
  // 경계선의 위도와 경도 좌표 (예시 좌표)
  const boundaryCoordinates = [];
  for (let i = 0; i < geoData.length; i++) {
    boundaryCoordinates.push({ lat: geoData[i][1], lon: geoData[i][0] });
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

  newJson.push({
    type: propertiesData.type,
    properties: propertiesData.properties,
    geometry: { type: "Polygon", coordinates: [simplifiedCoordinates] },
  });
  console.log(newJson);
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
