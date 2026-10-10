import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  geoEquirectangular,
  geoPath,
  geoGraticule10,
  geoInterpolate,
} from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-110m.json";

const countries = feature(atlas, atlas.objects.countries);
const fitDistance = (camera) =>
  1.12 /
  Math.sin(
    Math.atan(Math.tan((19 * Math.PI) / 180) * Math.min(1, camera.aspect)),
  );
const point = (lat, lng, radius = 1) => {
  const a = (lat * Math.PI) / 180,
    b = (lng * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(a) * Math.cos(b),
    Math.sin(a),
    -Math.cos(a) * Math.sin(b),
  ).multiplyScalar(radius);
};
function earthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#bccfc8";
  ctx.fillRect(0, 0, 2048, 1024);
  const projection = geoEquirectangular()
    .scale(2048 / (2 * Math.PI))
    .translate([1024, 512]);
  const path = geoPath(projection, ctx);
  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = "#94afa4";
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (const country of countries.features) {
    ctx.beginPath();
    path(country);
    ctx.fillStyle = "#f3efd9";
    ctx.fill();
    ctx.strokeStyle = "#829780";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose();
    child.material?.dispose();
    group.remove(child);
  }
}
export default function Globe3D({
  value,
  onChange,
  result,
  me,
  decorative = false,
}) {
  const host = useRef(null),
    sceneRef = useRef(null),
    current = useRef({ onChange });
  current.current = { onChange };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const root = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = renderer.domElement;
    root.appendChild(canvas);
    canvas.setAttribute(
      "aria-label",
      "Interactive 3D globe. Drag to rotate. Scroll or pinch to zoom. Click to place a guess.",
    );
    canvas.setAttribute("role", "img");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.copy(point(22, 15, 3.6));
    const texture = earthTexture();
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0,
      }),
    );
    scene.add(earth, new THREE.HemisphereLight("#fff9e7", "#647e70", 2.3));
    const sun = new THREE.DirectionalLight("#ffffff", 2);
    sun.position.set(3, 4, 5);
    scene.add(sun);
    const markers = new THREE.Group();
    scene.add(markers);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.minDistance = 1.65;
    controls.maxDistance = 5;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.7;
    controls.enableDamping = false;
    controls.update();
    controls.saveState();
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.position.setLength(
        Math.max(camera.position.length(), fitDistance(camera)),
      );
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = null,
      moved = false;
    const pointers = new Set();
    const start = (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) moved = true;
      else {
        down = { x: e.clientX, y: e.clientY };
        moved = false;
      }
    };
    const move = (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6)
        moved = true;
    };
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (
        !down ||
        moved ||
        pointers.size ||
        decorative ||
        !current.current.onChange ||
        e.button !== 0
      ) {
        if (!pointers.size) down = null;
        return;
      }
      down = null;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(earth)[0];
      if (!hit) return;
      const p = hit.point.normalize();
      current.current.onChange({
        lat: +(
          (Math.asin(THREE.MathUtils.clamp(p.y, -1, 1)) * 180) /
          Math.PI
        ).toFixed(4),
        lng: +((Math.atan2(-p.z, p.x) * 180) / Math.PI).toFixed(4),
      });
    };
    const cancel = () => {
      down = null;
      pointers.clear();
      moved = true;
    };
    const lost = (e) => {
      e.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("webglcontextlost", lost);
    sceneRef.current = { camera, controls, markers, render };
    resize();
    return () => {
      sceneRef.current = null;
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("webglcontextlost", lost);
      disposeGroup(markers);
      earth.geometry.dispose();
      earth.material.dispose();
      texture.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [decorative]);
  useEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    canvas?.setAttribute(
      "aria-label",
      `Interactive 3D globe. Drag to rotate. Scroll or pinch to zoom.${onChange ? " Click to place a guess." : ""}`,
    );
  }, [onChange]);
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const { markers, camera, controls, render } = state;
    disposeGroup(markers);
    const entries = result
      ? [
          { ...result.location, color: "#254638" },
          ...result.entries.map((e) => ({
            ...e,
            color: e.player === me ? "#e94e30" : "#304f83",
          })),
        ]
      : value
        ? [{ ...value, color: "#e94e30" }]
        : [];
    for (const entry of entries) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.075, 8),
        new THREE.MeshBasicMaterial({ color: entry.color }),
      );
      stem.position.copy(point(entry.lat, entry.lng, 1.037));
      stem.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        stem.position.clone().normalize(),
      );
      markers.add(stem);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 16, 12),
        new THREE.MeshBasicMaterial({ color: entry.color }),
      );
      marker.position.copy(point(entry.lat, entry.lng, 1.085));
      markers.add(marker);
    }
    if (result) {
      for (const entry of result.entries) {
        const interpolate = geoInterpolate(
          [entry.lng, entry.lat],
          [result.location.lng, result.location.lat],
        );
        const points = Array.from({ length: 65 }, (_, i) => {
          const [lng, lat] = interpolate(i / 64);
          return point(lat, lng, 1.012 + Math.sin((i / 64) * Math.PI) * 0.12);
        });
        markers.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: entry.player === me ? "#e94e30" : "#304f83",
            }),
          ),
        );
      }
    }
    render();
  }, [value?.lat, value?.lng, result, me]);
  const focus = () => {
    const s = sceneRef.current;
    if (!s) return;
    const p = result?.location || value;
    if (p) s.camera.position.copy(point(p.lat, p.lng, fitDistance(s.camera)));
    else s.controls.reset();
    s.controls.update();
    s.render();
  };
  useEffect(() => {
    if (result) focus();
  }, [result?.location?.lat, result?.location?.lng]);
  const zoom = (amount) => {
    const s = sceneRef.current;
    if (!s) return;
    s.camera.position.setLength(
      THREE.MathUtils.clamp(s.camera.position.length() * amount, 1.65, 5),
    );
    s.controls.update();
    s.render();
  };
  return (
    <div className={"globe-scene " + (decorative ? "globe-decorative" : "")}>
      <div className="globe-canvas" ref={host} />
      {failed && (
        <div className="globe-fallback" role="status">
          {decorative
            ? "A whole world to explore."
            : result
              ? "3D view unavailable. Destination and distances are shown below."
              : "3D view unavailable on this device. Use the latitude and longitude controls below to place your guess."}
        </div>
      )}
      {!decorative && (
        <>
          <div className="globe-tools">
            <button onClick={() => zoom(0.8)} aria-label="Zoom in">
              +
            </button>
            <button onClick={() => zoom(1.25)} aria-label="Zoom out">
              −
            </button>
            <button onClick={focus}>
              {result
                ? "Show destination"
                : value
                  ? "Find my pin"
                  : "Reset view"}
            </button>
          </div>
          <div className="globe-hint">
            DRAG TO EXPLORE · SCROLL OR PINCH TO ZOOM
            {onChange ? " · TAP TO PIN" : ""}
          </div>
        </>
      )}
    </div>
  );
}
