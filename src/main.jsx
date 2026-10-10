import Tutorial from "./Tutorial.jsx";
import Globe3D from "./Globe3D.jsx";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  Globe2,
  BookOpen,
  Copy,
  Check,
  MapPin,
  Flag,
  ChevronLeft,
  Plane,
  Users,
  VolumeX,
} from "lucide-react";
import "./style.css";
const storage = {
  get(k, f) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  },
};
const token = () => storage.get("postmark-token", "");
const invitation =
  new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "";
const invitedRoom = /^[A-Z0-9]{6}$/.test(invitation) ? invitation : "";
async function api(path, body) {
  const res = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not connect. Try again.");
  return data;
}
function Globe() {
  return <Globe3D decorative />;
}
function Stamp({ stamp, empty = false }) {
  return (
    <div
      className={"stamp " + (empty ? "empty" : "")}
      style={{ "--stamp": stamp?.color || "#91958b" }}
    >
      <div className="stamp-border">
        <span className="stamp-country">
          {stamp?.country || "YOUR NEXT STOP"}
        </span>
        <span className="stamp-symbol">{stamp?.symbol || "?"}</span>
        <strong>{stamp?.city || "Somewhere new"}</strong>
        <span className="stamp-small">
          {stamp ? `${stamp.code} · POSTMARK` : "THE WORLD IS WAITING"}
        </span>
      </div>
    </div>
  );
}
function Map(props) {
  return (
    <div className="map-frame">
      <Globe3D {...props} />
      <span className="map-caption">
        {props.result
          ? "ORANGE · YOU    BLUE · YOUR RIVAL    GREEN · DESTINATION"
          : "THE WHOLE WORLD. ONE GOOD GUESS."}
      </span>
    </div>
  );
}
function App() {
  const [tutorial, setTutorial] = useState(
    !storage.get("postmark-tutorial", false) && !token(),
  );
  function closeTutorial() {
    storage.set("postmark-tutorial", true);
    setTutorial(false);
  }
  const [page, setPage] = useState("home"),
    [profile, setProfile] = useState(null),
    [name, setName] = useState(storage.get("postmark-name", "")),
    [room, setRoom] = useState(null),
    [code, setCode] = useState(invitedRoom),
    [pin, setPin] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const lastRound = useRef(-1);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page, room?.phase]);
  useEffect(() => {
    const saved = storage.get("postmark-room", null);
    if (token())
      api("/me")
        .then(async (p) => {
          setProfile(p);
          // Restore identity before the result screen compares player scores.
          if (saved && !invitedRoom) {
            const r = await api("/rooms/" + saved);
            setRoom(r);
            setPage("game");
          }
        })
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (!room || page !== "game") return;
    let alive = true;
    const timer = setInterval(() => {
      api("/rooms/" + room.code)
        .then((r) => {
          if (alive) {
            setRoom(r);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 1200);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [room?.code, page]);
  useEffect(() => {
    if (room && room.round !== lastRound.current) {
      setPin(room.myGuess);
      lastRound.current = room.round;
    }
    if (room?.phase === "finished")
      api("/me")
        .then(setProfile)
        .catch(() => {});
  }, [room?.round, room?.phase]);
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function session() {
    if (profile) return;
    if (token()) {
      const existing = await api("/me");
      setProfile(existing);
      return;
    }
    const p = await api("/session", { name });
    storage.set("postmark-token", p.token);
    storage.set("postmark-name", p.name);
    setProfile(p);
  }
  async function start(practice) {
    await session();
    const r = await api("/rooms", { practice });
    setRoom(r);
    storage.set("postmark-room", r.code);
    setPin(null);
    lastRound.current = -1;
    window.history.replaceState(null, "", window.location.pathname);
    setPage("game");
  }
  async function join() {
    await session();
    const r = await api("/rooms/" + code.trim().toUpperCase() + "/join", {});
    setRoom(r);
    storage.set("postmark-room", r.code);
    setPin(null);
    lastRound.current = -1;
    window.history.replaceState(null, "", window.location.pathname);
    setPage("game");
  }
  async function copy() {
    try {
      const link = new URL(window.location.pathname, window.location.origin);
      link.searchParams.set("room", room.code);
      await navigator.clipboard.writeText(link.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy the room code shown above.");
    }
  }
  const self = room?.players.find((p) => p.id === profile?.id),
    other = room?.players.find((p) => p.id !== profile?.id),
    latest = room?.results.at(-1);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <button
          className="wordmark"
          onClick={() => setPage("home")}
          aria-label="Postmark home"
        >
          <span className="brand-icon">
            <Compass size={23} />
          </span>
          postmark<span className="brand-dot">®</span>
        </button>
        <nav>
          <button onClick={() => setTutorial(true)}>How to play</button>
          <button
            className={page === "home" || page === "game" ? "active" : ""}
            onClick={() => setPage(room ? "game" : "home")}
          >
            Play
            <ArrowUpRight size={14} />
          </button>
          <button
            className={page === "passport" ? "active" : ""}
            onClick={() => {
              setPage("passport");
              if (token())
                api("/me")
                  .then(setProfile)
                  .catch(() => {});
            }}
          >
            <BookOpen size={15} />
            My passport{" "}
            <span className="count">{profile?.stamps.length || 0}</span>
          </button>
        </nav>
        <div className="edition">
          A SMALL WORLD CLUB
          <br />
          <strong>EST. 2026 · VOL. 001</strong>
        </div>
      </header>
      {tutorial && <Tutorial onClose={closeTutorial} />}
      <main id="main">
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" /> YOUR NEXT LITTLE ADVENTURE
                </div>
                <h1>
                  Big world.
                  <br />
                  Good <em>guess.</em>
                </h1>
                <p className="intro">
                  A little friendly rivalry.
                  <br />A whole world to collect.
                </p>
                <p className="description">
                  Read the clues. Drop your pin. Outguess a friend.
                  <br className="desktop" /> Bring home a stamp from every stop.
                </p>
                <div className="ticket">
                  <div className="ticket-head">
                    <Plane size={18} />
                    <span>YOUR BOARDING PASS</span>
                    <span>01—03</span>
                  </div>
                  {!profile && (
                    <label className="name-label">
                      TRAVELLER NAME
                      <input
                        maxLength="24"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="What should we call you?"
                        autoComplete="nickname"
                      />
                    </label>
                  )}
                  {profile && (
                    <p className="welcome">
                      Ready for takeoff, <strong>{profile.name}</strong>?
                    </p>
                  )}
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => action(() => start(false))}
                  >
                    Challenge a friend <ArrowUpRight size={20} />
                  </button>
                  <div className="join-row">
                    <input
                      aria-label="Room code"
                      placeholder="Have a room code?"
                      maxLength="6"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                    />
                    <button
                      disabled={code.length !== 6 || busy}
                      onClick={() => action(join)}
                    >
                      Join <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                <button
                  className="practice-link"
                  disabled={busy}
                  onClick={() => action(() => start(true))}
                >
                  Just looking around? Try a practice trip{" "}
                  <ArrowRight size={14} />
                </button>
              </div>
              <div className="hero-art">
                <div className="orbit-label">NO PACKING REQUIRED ↗</div>
                <Globe />
                <div className="floating-stamp one">
                  <Stamp
                    stamp={{
                      country: "Japan",
                      city: "Kyoto",
                      code: "JP",
                      symbol: "⛩",
                      color: "#b94b38",
                    }}
                  />
                </div>
                <div className="floating-stamp two">
                  <Stamp
                    stamp={{
                      country: "Portugal",
                      city: "Lisbon",
                      code: "PT",
                      symbol: "☀",
                      color: "#ad7626",
                    }}
                  />
                </div>
                <div className="postmark-seal">
                  <span>THE WORLD IS YOURS</span>
                  <Compass size={34} />
                  <small>ONE GUESS AT A TIME</small>
                </div>
                <span className="art-coordinate">
                  35°00′N &nbsp; 135°46′E
                  <br />
                  SOMEWHERE YOU HAVEN’T BEEN. YET.
                </span>
              </div>
            </section>
            <section className="trip-strip">
              <div>
                <span className="step-no">01</span>
                <div>
                  <strong>Follow your curiosity.</strong>
                  <p>Same clues. Different instincts.</p>
                </div>
              </div>
              <div>
                <span className="step-no">02</span>
                <div>
                  <strong>Make your mark.</strong>
                  <p>Three rounds. Closest pin wins.</p>
                </div>
              </div>
              <div>
                <span className="step-no">03</span>
                <div>
                  <strong>Keep a little piece.</strong>
                  <p>A passport full of places.</p>
                </div>
              </div>
            </section>
            <div className="bottom-note">
              <span>FOR THE CURIOUS, NOT JUST THE WELL-TRAVELLED.</span>
              <span>
                2 FRIENDS &nbsp; / &nbsp; 3 ROUNDS &nbsp; / &nbsp; 1 WORLD
              </span>
            </div>
          </>
        )}
        {page === "game" && room && (
          <section className="game">
            <div className="game-top">
              <button className="back" onClick={() => setPage("home")}>
                <ChevronLeft size={16} /> Home
              </button>
              <span className="eyebrow">
                {room.practice
                  ? "PRACTICE TRIP · AUTOMATED GUIDE"
                  : "FRIENDLY DUEL"}{" "}
                &nbsp; / &nbsp; {room.code}
              </span>
              <span className="mode">
                {room.chain.verified
                  ? "MagicBlock verified"
                  : "Casual play · chain pending"}
              </span>
            </div>
            {room.phase === "lobby" ? (
              <div className="lobby">
                <div className="lobby-globe">
                  <Globe />
                </div>
                <div className="eyebrow">GOOD TRIPS NEED GOOD COMPANY</div>
                <h2>
                  Save a seat
                  <br />
                  for a <em>friend.</em>
                </h2>
                <p>
                  Copy an invite link, or send this code. Your trip begins when
                  they join.
                </p>
                <button
                  className="room-code"
                  onClick={copy}
                  aria-label={
                    copied ? "Invite link copied" : "Copy invite link"
                  }
                >
                  {room.code}
                  {copied ? <Check /> : <Copy size={21} />}
                </button>
                <span className="waiting">
                  <span className="live-dot" /> Waiting for your travel buddy
                </span>
              </div>
            ) : (
              <>
                <div className="scoreboard">
                  <div>
                    <span className="avatar">{self?.name?.[0] || "Y"}</span>
                    <span>
                      {self?.name || "You"}
                      <small>YOU</small>
                    </span>
                    <strong>{self?.score.toLocaleString()}</strong>
                  </div>
                  <span className="round-label">
                    ROUND {room.round + 1}
                    <small>OF 3</small>
                  </span>
                  <div>
                    <strong>{other?.score.toLocaleString()}</strong>
                    <span>
                      {other?.name || "Traveller"}
                      <small>YOUR RIVAL</small>
                    </span>
                    <span className="avatar rival">
                      {other?.name?.[0] || "P"}
                    </span>
                  </div>
                </div>
                {room.phase === "guessing" ? (
                  <>
                    <div className="clue">
                      <span className="eyebrow">
                        POSTCARD NO. 0{room.round + 1} <span> / </span> FIND
                        THIS PLACE
                      </span>
                      <h2>{room.clue.title}</h2>
                      <p>{room.clue.clue}</p>
                    </div>
                    <Map
                      value={pin || room.myGuess}
                      onChange={self?.locked ? null : setPin}
                    />
                    <div className="guess-controls">
                      <div>
                        <strong>
                          {self?.locked
                            ? "Your pin is locked."
                            : pin
                              ? "Looking good. Trust your instinct?"
                              : "Where in the world are we?"}
                        </strong>
                        <p>
                          {self?.locked
                            ? "Waiting for your friend. Both guesses reveal together."
                            : "Tap the globe to place your pin, or enter coordinates."}
                        </p>
                      </div>
                      <div className="coordinates">
                        <label>
                          LAT
                          <input
                            aria-label="Latitude"
                            type="number"
                            min="-90"
                            max="90"
                            step="0.01"
                            disabled={self?.locked}
                            value={pin?.lat ?? ""}
                            onChange={(e) =>
                              setPin({
                                lat: Number(e.target.value),
                                lng: pin?.lng ?? 0,
                              })
                            }
                          />
                        </label>
                        <label>
                          LNG
                          <input
                            aria-label="Longitude"
                            type="number"
                            min="-180"
                            max="180"
                            step="0.01"
                            disabled={self?.locked}
                            value={pin?.lng ?? ""}
                            onChange={(e) =>
                              setPin({
                                lat: pin?.lat ?? 0,
                                lng: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="primary"
                        disabled={!pin || self?.locked || busy}
                        onClick={() =>
                          action(async () =>
                            setRoom(
                              await api("/rooms/" + room.code + "/guess", {
                                ...pin,
                                round: room.round,
                              }),
                            ),
                          )
                        }
                      >
                        {self?.locked ? (
                          <>
                            <Check size={17} /> Locked in
                          </>
                        ) : (
                          <>
                            Lock my guess <MapPin size={17} />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="reveal-heading">
                      <div>
                        <span className="eyebrow">
                          {room.phase === "finished"
                            ? "THAT’S A WRAP"
                            : "WISH YOU WERE HERE"}
                        </span>
                        <h2>
                          {room.phase === "finished"
                            ? self.score === other.score
                              ? "A shared victory."
                              : self.score > other.score
                                ? "Nicely travelled."
                                : "What a journey."
                            : `Hello, ${latest.location.city}.`}
                        </h2>
                        <p>{latest.location.detail}</p>
                      </div>
                      <Stamp stamp={latest.location} />
                    </div>
                    <Map result={latest} me={profile?.id} />
                    <div className="result-row">
                      {latest.entries.map((e) => (
                        <div key={e.player}>
                          <span>
                            {room.players.find((p) => p.id === e.player)?.name}
                          </span>
                          <strong>
                            {Math.round(e.km).toLocaleString()}{" "}
                            <small>km away</small>
                          </strong>
                          <span className="points">
                            +{e.score.toLocaleString()} pts
                          </span>
                        </div>
                      ))}
                      <button
                        className="primary"
                        disabled={busy || self?.ready}
                        onClick={() =>
                          room.phase === "finished"
                            ? setPage("passport")
                            : action(async () =>
                                setRoom(
                                  await api(
                                    "/rooms/" + room.code + "/next",
                                    {},
                                  ),
                                ),
                              )
                        }
                      >
                        {room.phase === "finished"
                          ? "Open my passport"
                          : self?.ready
                            ? "Waiting for your friend"
                            : "Next destination"}{" "}
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    {room.phase === "finished" && (
                      <p className="award-note">
                        Three destinations, three souvenirs.{" "}
                        {room.practice
                          ? "Practice stamps are marked in your passport."
                          : "Your stamps are waiting in your passport."}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )}
        {page === "passport" && (
          <section className="passport">
            <div className="passport-title">
              <div>
                <span className="eyebrow">THE PLACES STAY WITH YOU</span>
                <h1>
                  Your little
                  <br />
                  <em>world book.</em>
                </h1>
                <p>Every trip leaves a mark. These are yours.</p>
              </div>
              <div className="passport-number">
                <BookOpen size={30} />
                <strong>
                  {String(profile?.stamps.length || 0).padStart(2, "0")}
                </strong>
                <span>PLACES COLLECTED</span>
              </div>
            </div>
            <div className="passport-meta">
              <span>
                ISSUED TO{" "}
                <strong>{profile?.name || "A curious traveller"}</strong>
              </span>
              <span>{profile?.matches.length || 0} TRIPS COMPLETED</span>
            </div>
            <div className="stamp-grid">
              {profile?.stamps.map((s) => (
                <div className="passport-entry" key={s.id}>
                  <Stamp stamp={s} />
                  <span>{s.region}</span>
                  <small>
                    {s.practice ? "Practice souvenir" : "Duel souvenir"} ·{" "}
                    {new Date(s.earnedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </div>
              ))}
              {Array.from(
                { length: Math.max(1, 6 - (profile?.stamps.length || 0)) },
                (_, i) => (
                  <div className="passport-entry" key={"empty" + i}>
                    <Stamp empty />
                  </div>
                ),
              )}
            </div>
            <button
              className="primary passport-cta"
              onClick={() => setPage("home")}
            >
              There’s more out there <ArrowUpRight size={19} />
            </button>
          </section>
        )}
      </main>
      <footer>
        <span>
          <Compass size={15} /> MADE FOR THE DETOUR.
        </span>
        <span>POSTMARK · A MAGICBLOCK BUILD IN PROGRESS</span>
        <span>
          <Globe2 size={14} /> THE WORLD IS OPEN
        </span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
