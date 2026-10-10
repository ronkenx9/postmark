import React, { useEffect, useRef, useState } from "react";
import { geoDistance } from "d3-geo";
import Globe3D from "./Globe3D.jsx";
const stop = { lat: 38.6916, lng: -9.216, city: "Lisbon" };
export default function Tutorial({ onClose }) {
  const dialog = useRef(null);
  const [step, setStep] = useState(0),
    [pin, setPin] = useState(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const distance = pin
    ? Math.round(geoDistance([pin.lng, pin.lat], [stop.lng, stop.lat]) * 6371)
    : 0;
  const headings = [
    "The world is in your hands.",
    "Make your best guess.",
    "Closer earns more.",
    "Bring the world home.",
  ];
  const descriptions = [
    "Drag the globe to turn it. Scroll, pinch, or use + and − to zoom. Try it here.",
    "A practice clue: a famous riverside tower stands in Portugal’s capital. Tap the globe to place a pin. You can move it until you lock it.",
    "In a duel, both guesses stay hidden until both players lock. Then the destination, distances and points appear together.",
    "Play three rounds. The highest total wins, and both travellers collect destination stamps in My passport. Try a practice trip before inviting a friend.",
  ];
  return (
    <dialog
      className="tutorial"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="tutorial-title"
    >
      <div className="tutorial-top">
        <span className="eyebrow">YOUR FIRST LITTLE TRIP · {step + 1} / 4</span>
        <button onClick={onClose} aria-label="Close tutorial">
          ×
        </button>
      </div>
      <h2 id="tutorial-title">{headings[step]}</h2>
      <p>{descriptions[step]}</p>
      {step < 3 ? (
        <Globe3D
          value={pin}
          onChange={step === 1 ? setPin : null}
          result={
            step === 2
              ? { location: stop, entries: [{ ...pin, player: "you" }] }
              : null
          }
          me="you"
        />
      ) : (
        <div className="tutorial-passport">
          <span>✈</span>
          <strong>3 stops. A passport full of stories.</strong>
          <p>
            Your practice stamps are labelled, and your duel souvenirs stay
            saved in this browser’s traveller profile.
          </p>
        </div>
      )}
      {step === 1 && (
        <p className="tutorial-status" aria-live="polite">
          {pin
            ? `Pin placed: ${pin.lat.toFixed(1)}°, ${pin.lng.toFixed(1)}°. Ready to lock?`
            : "Tap anywhere on the globe to try a guess."}
        </p>
      )}
      {step === 2 && (
        <p className="tutorial-status">
          Lisbon, Portugal · {distance.toLocaleString()} km from your pin. This
          is a tutorial; no match or stamp is recorded.
        </p>
      )}
      <div className="tutorial-actions">
        <button onClick={onClose}>Skip tutorial</button>
        <button
          className="primary"
          disabled={step === 1 && !pin}
          onClick={() => (step === 3 ? onClose() : setStep(step + 1))}
        >
          {step === 1
            ? "Lock practice pin"
            : step === 3
              ? "Ready to play"
              : "Continue"}{" "}
          →
        </button>
      </div>
    </dialog>
  );
}
