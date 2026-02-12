import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { labelForTerritory, worldClassic } from "./map/worldClassic";
import objectiveCardTemplateRaw from "@packs/maps/world-classic/cards/objective/objective_card_blank.svg?raw";
import jokerCardRaw from "@packs/maps/world-classic/cards/joker/joker_card.svg?raw";
import objectiveCardBackRaw from "@packs/assets/card-backs/objective_card_back.svg?raw";
import territoryCardBackRaw from "@packs/assets/card-backs/territory_card_back.svg?raw";
import playerCardRed from "@packs/maps/world-classic/cards/player/player_card_red.svg";
import playerCardPurple from "@packs/maps/world-classic/cards/player/player_card_purple.svg";
import playerCardYellow from "@packs/maps/world-classic/cards/player/player_card_yellow.svg";
import playerCardGreen from "@packs/maps/world-classic/cards/player/player_card_green.svg";
import playerCardBlue from "@packs/maps/world-classic/cards/player/player_card_blue.svg";
import playerCardBlack from "@packs/maps/world-classic/cards/player/player_card_black.svg";

type Screen = "splash" | "portal" | "hostLobby" | "joinLobby" | "game";

type TerritoryOverlay = {
  id: string;
  text: string;
  centerX: number;
  centerY: number;
  chipRadius: number;
  labelX: number;
  labelY: number;
  labelFontSize: number;
  labelWidth: number;
  labelHeight: number;
};

type HostTerritoryState = {
  territoryId: string;
  ownerPlayerId: string;
  armies: number;
  neighborTerritoryIds: string[];
};

type HostPlayerState = {
  playerId: string;
  displayName: string;
  isEliminated: boolean;
};

type HostObjectiveState = {
  playerId: string;
  objectiveId: string;
  title: string;
  description: string;
  kind: string;
  targetTerritoryCount: number;
  requiredArmiesPerTerritory?: number;
  requiredContinentIds?: string[];
  requiredAdditionalContinentCount?: number;
  eliminateTargetPlayerId?: string | null;
};

type HostGameState = {
  matchId: string;
  players: HostPlayerState[];
  continents?: { id: string; bonus: number; territoryIds: string[] }[];
  phase: string | number;
  turnIndex: number;
  roundIndex: number;
  activePlayerId: string;
  reinforcementsAvailable: number;
  territories: Record<string, HostTerritoryState>;
  objectivesByPlayerId?: Record<string, HostObjectiveState>;
  cardIdsByPlayerId?: Record<string, string[]>;
  winnerPlayerId?: string | null;
};

type MatchStateResponse = {
  matchId: string;
  roomId: string;
  state: HostGameState;
};

type RoomParticipant = {
  peerId: string;
  displayName: string;
  joinedAtUtc: string;
};

type RoomLobbySummary = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
};

type RoomSnapshotResponse = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  activeMatchId?: string | null;
  participants: RoomParticipant[];
};

type CreateRoomResponse = {
  roomId: string;
  roomName: string;
  hostPeerId: string;
  mapId: string;
  status: string;
  participants: RoomParticipant[];
};

type JoinRoomResponse = {
  roomId: string;
  roomName: string;
  mapId: string;
  hostPeerId: string;
  status: string;
  activeMatchId?: string | null;
  participants: RoomParticipant[];
};

type StartMatchResponse = {
  roomId: string;
  roomName: string;
  matchId: string;
  mapId: string;
  hostPeerId: string;
  status: string;
  participants: RoomParticipant[];
};

type SubmitCommandResponse = {
  accepted: boolean;
  errorCode: number;
  message: string;
  appliedEventCount: number;
};

const PREF_KEY = "RisiKo!.ui.v4";
const PLAYER_COLORS = ["#e43c39", "#7d49dc", "#e6c42b", "#2ecb4f", "#2a6ae0", "#141414"];
const PLAYER_CARD_ASSETS = [playerCardRed, playerCardPurple, playerCardYellow, playerCardGreen, playerCardBlue, playerCardBlack];
const OBJECTIVE_CARD_BASE = objectiveCardTemplateRaw.replace("Testo missione qui", "");
const territoryCardModules = import.meta.glob("@packs/maps/world-classic/cards/territory/*.svg", {
  eager: true,
  import: "default",
  query: "?raw"
}) as Record<string, string>;

const territoryCardSvgById = Object.entries(territoryCardModules).reduce<Record<string, string>>((map, [path, svg]) => {
  const fileName = path.split("/").pop()?.replace(".svg", "");
  if (!fileName) {
    return map;
  }
  const territoryId = fileName.toLowerCase();
  map[territoryId] = svg;
  return map;
}, {});

function commandErrorLabel(errorCode: number): string {
  switch (errorCode) {
    case 0:
      return "nessuno";
    case 1:
      return "fase_non_valida";
    case 2:
      return "giocatore_non_attivo";
    case 3:
      return "proprieta_non_valida";
    case 4:
      return "non_adiacente";
    case 5:
      return "numero_armate_non_valido";
    case 6:
      return "percorso_non_valido";
    case 7:
      return "partita_terminata";
    case 8:
      return "carte_non_valide";
    default:
      return "sconosciuto";
  }
}

function parsePhase(phase: unknown): string {
  const value = String(phase ?? "").toLowerCase();
  if (value === "0") {
    return "setup";
  }
  if (value === "1") {
    return "reinforcement";
  }
  if (value === "2") {
    return "attack";
  }
  if (value === "3") {
    return "fortify";
  }
  return value || "reinforcement";
}

function prettyCardName(cardId: string): string {
  if (cardId.startsWith("territory:")) {
    return cardId.replace("territory:", "").split("_").join(" ");
  }
  if (cardId.startsWith("joker")) {
    return "Joker";
  }
  return cardId;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "setup":
      return "setup";
    case "reinforcement":
      return "rinforzo";
    case "attack":
      return "attacco";
    case "fortify":
      return "fortifica";
    default:
      return phase;
  }
}

function commandLabel(type: string): string {
  switch (type) {
    case "PlaceReinforcements":
      return "piazzamento rinforzi";
    case "Attack":
      return "attacco";
    case "Fortify":
      return "fortificazione";
    case "EndTurn":
      return "fine turno";
    default:
      return type;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function boxesOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toTerritoryFileBase(territoryId: string): string {
  return territoryId
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_")
    .toLowerCase();
}

function svgForTerritoryCard(territoryId: string): string | null {
  const key = toTerritoryFileBase(territoryId);
  return territoryCardSvgById[key] ?? null;
}

function isLikelySetupComplete(state: HostGameState | null, phase: string): boolean {
  if (!state) {
    return false;
  }
  return phase !== "setup";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

function canReachOwnedTarget(
  territories: Record<string, HostTerritoryState>,
  playerId: string,
  fromId: string,
  toId: string
): boolean {
  if (fromId === toId) {
    return true;
  }
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = territories[currentId];
    if (!current) {
      continue;
    }
    for (const nextId of current.neighborTerritoryIds) {
      if (visited.has(nextId)) {
        continue;
      }
      const next = territories[nextId];
      if (!next || next.ownerPlayerId !== playerId) {
        continue;
      }
      if (nextId === toId) {
        return true;
      }
      visited.add(nextId);
      queue.push(nextId);
    }
  }
  return false;
}

function App() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const dealStartedMatchRef = useRef<string | null>(null);
  const dealTimerIdsRef = useRef<number[]>([]);

  const boot = useMemo(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  }, []);

  const [screen, setScreen] = useState<Screen>("splash");
  const [hostUrl, setHostUrl] = useState(boot?.hostUrl ?? "http://localhost:5050");

  const [hostDisplayName, setHostDisplayName] = useState(boot?.hostDisplayName ?? "Host");
  const [hostPeerId, setHostPeerId] = useState(boot?.hostPeerId ?? "host-local");
  const [roomName, setRoomName] = useState(boot?.roomName ?? "RisiKo! Lobby");

  const [joinDisplayName, setJoinDisplayName] = useState(boot?.joinDisplayName ?? "Peer");
  const [joinPeerId, setJoinPeerId] = useState(boot?.joinPeerId ?? "peer-local-2");
  const [availableRooms, setAvailableRooms] = useState<RoomLobbySummary[]>([]);

  const [roomId, setRoomId] = useState(boot?.roomId ?? "");
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshotResponse | null>(null);
  const [matchId, setMatchId] = useState(boot?.matchId ?? "");

  const [peerId, setPeerId] = useState(boot?.peerId ?? "");
  const [playerId, setPlayerId] = useState(boot?.playerId ?? "");

  const [state, setState] = useState<HostGameState | null>(null);
  const [syncOn, setSyncOn] = useState(false);
  const [status, setStatus] = useState("Pronto.");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ id: number; author: string; text: string; at: string }[]>([]);
  const [dealStage, setDealStage] = useState<"idle" | "objective" | "territories" | "complete">("idle");
  const [dealMatchId, setDealMatchId] = useState("");
  const [revealedTerritories, setRevealedTerritories] = useState<string[]>([]);
  const [dealtTerritoryOrder, setDealtTerritoryOrder] = useState<string[]>([]);
  const [dealFlyToHand, setDealFlyToHand] = useState(false);
  const [setupDeckVisible, setSetupDeckVisible] = useState(true);
  const [mapScale, setMapScale] = useState(1);
  const [mapMinScale, setMapMinScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [regionOverlays, setRegionOverlays] = useState<TerritoryOverlay[]>([]);
  const [mapViewBox, setMapViewBox] = useState("0 0 1000 700");
  const [hoverTerritoryId, setHoverTerritoryId] = useState("");

  const [reinforceTerritoryId, setReinforceTerritoryId] = useState("");
  const [reinforceArmies, setReinforceArmies] = useState(1);
  const [attackFromId, setAttackFromId] = useState("");
  const [attackToId, setAttackToId] = useState("");
  const [attackDice, setAttackDice] = useState(1);
  const [fortifyFromId, setFortifyFromId] = useState("");
  const [fortifyToId, setFortifyToId] = useState("");
  const [fortifyArmies, setFortifyArmies] = useState(1);

  const currentPhase = parsePhase(state?.phase);
  const myObjective = state?.objectivesByPlayerId?.[playerId];
  const objectiveTarget = myObjective?.targetTerritoryCount ?? null;
  const territoryList = Object.values(state?.territories ?? {});
  const ownedTerritories = territoryList.filter(territory => territory.ownerPlayerId === playerId);
  const objectiveOwned = ownedTerritories.length;
  const objectiveRemaining = objectiveTarget === null ? null : Math.max(0, objectiveTarget - objectiveOwned);
  const handCount = state?.cardIdsByPlayerId?.[playerId]?.length ?? 0;
  const myCards = state?.cardIdsByPlayerId?.[playerId] ?? [];
  const ownedTerritoryIds = ownedTerritories.map(territory => territory.territoryId);
  const ownedTerritoryIdSet = useMemo(() => new Set(ownedTerritoryIds), [ownedTerritoryIds]);
  const setupComplete = isLikelySetupComplete(state, currentPhase);
  const isMyTurn = !!state && state.activePlayerId === playerId;
  const isHostInLobby = !!roomSnapshot && roomSnapshot.hostPeerId === peerId;
  const activePlayer = state?.players.find(player => player.playerId === state.activePlayerId);
  const activePlayerLabel = activePlayer
    ? `${activePlayer.displayName} (${activePlayer.playerId})`
    : state?.activePlayerId ?? "-";
  const phaseInstruction =
    currentPhase === "setup"
      ? "Setup iniziale: piazza fino a 3 rinforzi totali sul tuo turno (solo su territori posseduti). Il turno passa quando finisci i rinforzi disponibili."
      : currentPhase === "reinforcement"
      ? "Piazza tutti i rinforzi disponibili, poi premi Fine / Prossimo."
      : currentPhase === "attack"
        ? "Attacca uno o piu territori adiacenti, oppure premi Fine / Prossimo."
        : "Fortifica una volta (opzionale), poi premi Fine / Prossimo.";

  const playerRows = useMemo(() => {
    if (!state) {
      return [];
    }
    return state.players.map((player, index) => {
      const owned = Object.values(state.territories).filter(territory => territory.ownerPlayerId === player.playerId).length;
      const byTerritory = Math.max(3, Math.floor(owned / 3));
      const continentBonus =
        state.continents?.reduce((total, continent) => {
          const ownsAll = continent.territoryIds.every(id => state.territories[id]?.ownerPlayerId === player.playerId);
          return total + (ownsAll ? continent.bonus : 0);
        }, 0) ?? 0;
      const nextRound = byTerritory + continentBonus;
      return {
        player,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        cardAsset: PLAYER_CARD_ASSETS[index % PLAYER_CARD_ASSETS.length],
        owned,
        nextRound,
        cardCount: state.cardIdsByPlayerId?.[player.playerId]?.length ?? 0,
        placeableNow: state.activePlayerId === player.playerId ? state.reinforcementsAvailable : 0
      };
    });
  }, [state]);

  const attackSourceOptions = ownedTerritories.filter(territory => territory.armies > 1);
  const attackSourceIdSet = useMemo(() => new Set(attackSourceOptions.map(territory => territory.territoryId)), [attackSourceOptions]);
  const selectedAttackSource = state?.territories?.[attackFromId];
  const attackTargetOptions =
    selectedAttackSource?.neighborTerritoryIds
      .map(id => state?.territories?.[id])
      .filter((territory): territory is HostTerritoryState => !!territory && territory.ownerPlayerId !== playerId) ?? [];

  const fortifySourceOptions = ownedTerritories.filter(territory => territory.armies > 1);
  const fortifyTargetOptions = ownedTerritories.filter(territory => {
    if (!state || !fortifyFromId || territory.territoryId === fortifyFromId) {
      return false;
    }
    return canReachOwnedTarget(state.territories, playerId, fortifyFromId, territory.territoryId);
  });
  const reinforceMax = Math.max(1, state?.reinforcementsAvailable ?? 1);
  const possibleAttackTargetIds = useMemo(() => {
    if (!state || currentPhase !== "attack" || !isMyTurn) {
      return new Set<string>();
    }

    const result = new Set<string>();
    if (attackFromId && state.territories[attackFromId]) {
      for (const neighborId of state.territories[attackFromId].neighborTerritoryIds) {
        const target = state.territories[neighborId];
        if (target && target.ownerPlayerId !== playerId) {
          result.add(neighborId);
        }
      }
      return result;
    }

    for (const source of attackSourceOptions) {
      for (const neighborId of source.neighborTerritoryIds) {
        const target = state.territories[neighborId];
        if (target && target.ownerPlayerId !== playerId) {
          result.add(neighborId);
        }
      }
    }
    return result;
  }, [attackFromId, attackSourceOptions, currentPhase, isMyTurn, playerId, state]);
  const playerColorById = useMemo(() => {
    if (!state) {
      return {} as Record<string, string>;
    }
    const map: Record<string, string> = {};
    state.players.forEach((player, index) => {
      map[player.playerId] = PLAYER_COLORS[index % PLAYER_COLORS.length];
    });
    return map;
  }, [state]);
  const hoveredTerritoryLabel = hoverTerritoryId ? labelForTerritory(hoverTerritoryId) : "-";

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (!state || !isMyTurn) {
        return;
      }
      const territory = state.territories[territoryId];
      if (!territory) {
        return;
      }

      if (currentPhase === "reinforcement" || currentPhase === "setup") {
        if (territory.ownerPlayerId === playerId) {
          setReinforceTerritoryId(current => (current === territoryId ? "" : territoryId));
          setStatus(`Rinforzo selezionato: ${labelForTerritory(territoryId)}`);
        }
        return;
      }

      if (currentPhase === "attack") {
        if (territory.ownerPlayerId === playerId && territory.armies > 1) {
          setAttackFromId(territoryId);
          setAttackToId("");
          setStatus(`Attacco da: ${labelForTerritory(territoryId)}. Seleziona il bersaglio.`);
          return;
        }
        if (!attackFromId) {
          return;
        }
        const source = state.territories[attackFromId];
        if (!source) {
          return;
        }
        if (source.neighborTerritoryIds.includes(territoryId) && territory.ownerPlayerId !== playerId) {
          setAttackToId(territoryId);
          setStatus(`Bersaglio attacco: ${labelForTerritory(territoryId)}`);
        }
        return;
      }

      if (currentPhase === "fortify" && territory.ownerPlayerId === playerId) {
        if (!fortifyFromId || fortifyFromId === territoryId) {
          setFortifyFromId(territoryId);
          setFortifyToId("");
          setStatus(`Fortifica da: ${labelForTerritory(territoryId)}.`);
          return;
        }
        const canReach = canReachOwnedTarget(state.territories, playerId, fortifyFromId, territoryId);
        if (canReach) {
          setFortifyToId(territoryId);
          setStatus(`Fortifica verso: ${labelForTerritory(territoryId)}.`);
        }
      }
    },
    [attackFromId, currentPhase, fortifyFromId, isMyTurn, playerId, state]
  );

  const clearMapSelections = useCallback(() => {
    if (currentPhase === "setup" || currentPhase === "reinforcement") {
      setReinforceTerritoryId("");
      return;
    }
    if (currentPhase === "attack") {
      setAttackFromId("");
      setAttackToId("");
      return;
    }
    if (currentPhase === "fortify") {
      setFortifyFromId("");
      setFortifyToId("");
    }
  }, [currentPhase]);

  useEffect(() => {
    const timer = setTimeout(() => setScreen("portal"), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({
        hostUrl,
        hostDisplayName,
        hostPeerId,
        roomName,
        joinDisplayName,
        joinPeerId,
        roomId,
        matchId,
        peerId,
        playerId
      })
    );
  }, [hostDisplayName, hostPeerId, hostUrl, joinDisplayName, joinPeerId, matchId, peerId, playerId, roomId, roomName]);

  useEffect(() => {
    if (screen !== "joinLobby" && screen !== "portal") {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const rooms = await getJson<RoomLobbySummary[]>(`${hostUrl}/api/rooms`);
        if (cancelled) {
          return;
        }
        setAvailableRooms(rooms.filter(room => room.status === "open"));
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore elenco stanze: ${(error as Error).message}`);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, screen]);

  useEffect(() => {
    if (!roomId || (screen !== "hostLobby" && screen !== "joinLobby")) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const room = await getJson<RoomSnapshotResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(roomId)}`);
        if (cancelled) {
          return;
        }
        setRoomSnapshot(room);
        if (room.activeMatchId) {
          setMatchId(room.activeMatchId);
          setSyncOn(true);
          setScreen("game");
          setStatus(`Partita avviata: ${room.activeMatchId}`);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore sincronizzazione lobby: ${(error as Error).message}`);
        }
      }
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, roomId, screen]);

  useEffect(() => {
    if (!syncOn || !matchId) {
      return;
    }
    let cancelled = false;
    const pollState = async () => {
      try {
        const payload = await getJson<MatchStateResponse>(`${hostUrl}/api/matches/${encodeURIComponent(matchId)}/state`);
        if (cancelled) {
          return;
        }
        setState(payload.state);
        if (payload.roomId && payload.roomId !== roomId) {
          setRoomId(payload.roomId);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(`Errore sincronizzazione stato: ${(error as Error).message}`);
        }
      }
    };
    pollState();
    const timer = setInterval(pollState, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hostUrl, matchId, roomId, syncOn]);

  useEffect(() => {
    if (!ownedTerritories.length) {
      setReinforceTerritoryId("");
      return;
    }
    if (!ownedTerritories.some(territory => territory.territoryId === reinforceTerritoryId)) {
      setReinforceTerritoryId(ownedTerritories[0].territoryId);
    }
  }, [ownedTerritories, reinforceTerritoryId]);

  useEffect(() => {
    if (!attackSourceOptions.length) {
      setAttackFromId("");
      setAttackToId("");
      return;
    }
    if (!attackSourceOptions.some(territory => territory.territoryId === attackFromId)) {
      setAttackFromId(attackSourceOptions[0].territoryId);
    }
  }, [attackFromId, attackSourceOptions]);

  useEffect(() => {
    if (!attackTargetOptions.length) {
      setAttackToId("");
      return;
    }
    if (!attackTargetOptions.some(territory => territory.territoryId === attackToId)) {
      setAttackToId(attackTargetOptions[0].territoryId);
    }
  }, [attackTargetOptions, attackToId]);

  useEffect(() => {
    if (!fortifySourceOptions.length) {
      setFortifyFromId("");
      setFortifyToId("");
      return;
    }
    if (!fortifySourceOptions.some(territory => territory.territoryId === fortifyFromId)) {
      setFortifyFromId(fortifySourceOptions[0].territoryId);
    }
  }, [fortifyFromId, fortifySourceOptions]);

  useEffect(() => {
    if (!fortifyTargetOptions.length) {
      setFortifyToId("");
      return;
    }
    if (!fortifyTargetOptions.some(territory => territory.territoryId === fortifyToId)) {
      setFortifyToId(fortifyTargetOptions[0].territoryId);
    }
  }, [fortifyTargetOptions, fortifyToId]);

  useEffect(() => {
    if (reinforceArmies > reinforceMax) {
      setReinforceArmies(reinforceMax);
    }
  }, [reinforceArmies, reinforceMax]);

  useEffect(() => {
    return () => {
      dealTimerIdsRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (screen !== "game" || !state || !matchId || !playerId) {
      return;
    }

    if (dealStartedMatchRef.current === matchId) {
      return;
    }

    dealStartedMatchRef.current = matchId;
    setDealMatchId(matchId);
    setDealStage("objective");
    setDealFlyToHand(false);
    setSetupDeckVisible(true);
    setRevealedTerritories([]);

    const shuffled = [...ownedTerritoryIds].sort(() => Math.random() - 0.5);
    setDealtTerritoryOrder(shuffled);
    const objectiveRevealMs = 5000;
    const territoryDealStepMs = 320;
    const territoryDealStartMs = objectiveRevealMs + 200;
    const territoryDealDurationMs = shuffled.length * territoryDealStepMs;
    const completeStageMs = territoryDealStartMs + territoryDealDurationMs + 900;
    const closeOverlayMs = completeStageMs + 1600;
    dealTimerIdsRef.current.forEach(timer => clearTimeout(timer));
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setDealStage("territories"), objectiveRevealMs));

    for (let i = 0; i < shuffled.length; i++) {
      timers.push(
        window.setTimeout(() => {
          setRevealedTerritories(current => (current.includes(shuffled[i]) ? current : [...current, shuffled[i]]));
        }, territoryDealStartMs + i * territoryDealStepMs)
      );
    }

    timers.push(
      window.setTimeout(() => {
        setDealStage("complete");
        setDealFlyToHand(true);
        setStatus("Distribuzione completata. Puoi iniziare il piazzamento iniziale.");
      }, completeStageMs)
    );

    timers.push(
      window.setTimeout(() => {
        setDealStage("idle");
        setDealFlyToHand(false);
      }, closeOverlayMs)
    );
    dealTimerIdsRef.current = timers;
  }, [matchId, playerId, screen, state]);

  useEffect(() => {
    if (!setupDeckVisible || !setupComplete || dealStage !== "idle") {
      return;
    }
    setDealtTerritoryOrder(previous => [...previous].sort(() => Math.random() - 0.5));
    setSetupDeckVisible(false);
    setStatus("Setup completato. Carte territorio rimescolate, partita attiva.");
  }, [dealStage, setupComplete, setupDeckVisible]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const svg = mapRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    const points: Array<{
      id: string;
      centerX: number;
      centerY: number;
      text: string;
      chipRadius: number;
      labelFontSize: number;
      labelWidth: number;
      labelHeight: number;
    }> = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const nextOverlays: TerritoryOverlay[] = [];

    for (const territory of worldClassic.map.territories) {
      const node = svg.querySelector(`#${CSS.escape(territory.id)}`) as SVGGraphicsElement | null;
      if (!node || typeof node.getBBox !== "function") {
        continue;
      }

      try {
        const box = node.getBBox();
        if (box.width <= 0 || box.height <= 0) {
          continue;
        }

        const ctm = node.getCTM();
        if (!ctm) {
          continue;
        }

        const centerPoint = svg.createSVGPoint();
        centerPoint.x = box.x + box.width / 2;
        centerPoint.y = box.y + box.height / 2;
        const transformedCenter = centerPoint.matrixTransform(ctm);

        const corners = [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x, y: box.y + box.height },
          { x: box.x + box.width, y: box.y + box.height }
        ].map(corner => {
          const point = svg.createSVGPoint();
          point.x = corner.x;
          point.y = corner.y;
          return point.matrixTransform(ctm);
        });

        for (const corner of corners) {
          minX = Math.min(minX, corner.x);
          minY = Math.min(minY, corner.y);
          maxX = Math.max(maxX, corner.x);
          maxY = Math.max(maxY, corner.y);
        }

        const boundsWidth = Math.max(...corners.map(corner => corner.x)) - Math.min(...corners.map(corner => corner.x));
        const boundsHeight = Math.max(...corners.map(corner => corner.y)) - Math.min(...corners.map(corner => corner.y));
        const territorySpan = Math.max(8, Math.min(boundsWidth, boundsHeight));
        const text = labelForTerritory(territory.id);
        const chipRadius = clamp(territorySpan * 0.18, 7, 16);
        const baseFontSize = clamp(territorySpan * 0.17, 8.6, 16);
        const lengthCap = clamp(180 / Math.max(7, text.length), 8.2, 16);
        const labelFontSize = Math.min(baseFontSize, lengthCap);
        const labelWidth = Math.max(38, text.length * labelFontSize * 0.54);
        const labelHeight = Math.max(11, labelFontSize * 1.16);

        points.push({
          id: territory.id,
          centerX: transformedCenter.x,
          centerY: transformedCenter.y,
          text,
          chipRadius,
          labelFontSize,
          labelWidth,
          labelHeight
        });
      } catch {
        // ignore malformed region geometry
      }
    }

    if (points.length > 0 && Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
      const padding = 24;
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const normalizedViewBox = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;
      svg.setAttribute("viewBox", normalizedViewBox);
      setMapViewBox(normalizedViewBox);
    } else {
      const fallback = svg.getAttribute("viewBox");
      if (fallback) {
        setMapViewBox(fallback);
      }
    }

    const placedBoxes: { left: number; top: number; right: number; bottom: number }[] = points.map(point => ({
      left: point.centerX - point.chipRadius - 2,
      top: point.centerY - point.chipRadius - 2,
      right: point.centerX + point.chipRadius + 2,
      bottom: point.centerY + point.chipRadius + 2
    }));
    const sortedPoints = [...points].sort((a, b) => b.chipRadius - a.chipRadius);
    const safeMinX = minX + 8;
    const safeMinY = minY + 8;
    const safeMaxX = maxX - 8;
    const safeMaxY = maxY - 8;
    for (const point of sortedPoints) {
      let selected = {
        x: point.centerX,
        y: point.centerY + point.chipRadius + point.labelHeight * 0.95
      };
      let placed = false;

      const baseDistance = point.chipRadius + point.labelHeight * 0.92;
      for (let ring = 0; ring < 14 && !placed; ring++) {
        const distance = baseDistance + ring * Math.max(5.5, point.labelHeight * 0.68);
        for (let angleDeg = 0; angleDeg < 360; angleDeg += 22.5) {
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = point.centerX + Math.cos(angleRad) * distance;
          const y = point.centerY + Math.sin(angleRad) * distance;
          const box = {
            left: x - point.labelWidth / 2 - 4,
            top: y - point.labelHeight / 2 - 3,
            right: x + point.labelWidth / 2 + 4,
            bottom: y + point.labelHeight / 2 + 3
          };
          if (box.left < safeMinX || box.right > safeMaxX || box.top < safeMinY || box.bottom > safeMaxY) {
            continue;
          }

          const overlaps = placedBoxes.some(existing =>
            !(box.right < existing.left || box.left > existing.right || box.bottom < existing.top || box.top > existing.bottom));

          if (!overlaps) {
            selected = { x, y };
            placedBoxes.push(box);
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        const maxSearch = 280;
        const step = Math.max(5, Math.round(point.labelHeight * 0.55));
        for (let dy = 0; dy <= maxSearch && !placed; dy += step) {
          for (let dx = 0; dx <= maxSearch && !placed; dx += step) {
            const variants = [
              { x: point.centerX + dx, y: point.centerY + dy },
              { x: point.centerX - dx, y: point.centerY + dy },
              { x: point.centerX + dx, y: point.centerY - dy },
              { x: point.centerX - dx, y: point.centerY - dy }
            ];
            for (const variant of variants) {
              const box = {
                left: variant.x - point.labelWidth / 2 - 4,
                top: variant.y - point.labelHeight / 2 - 3,
                right: variant.x + point.labelWidth / 2 + 4,
                bottom: variant.y + point.labelHeight / 2 + 3
              };
              if (box.left < safeMinX || box.right > safeMaxX || box.top < safeMinY || box.bottom > safeMaxY) {
                continue;
              }
              if (placedBoxes.some(existing => boxesOverlap(box, existing))) {
                continue;
              }
              selected = variant;
              placedBoxes.push(box);
              placed = true;
              break;
            }
          }
        }
      }

      if (!placed) {
        const fallbackBox = {
          left: selected.x - point.labelWidth / 2 - 4,
          top: selected.y - point.labelHeight / 2 - 3,
          right: selected.x + point.labelWidth / 2 + 4,
          bottom: selected.y + point.labelHeight / 2 + 3
        };
        placedBoxes.push(fallbackBox);
      }

      nextOverlays.push({
        id: point.id,
        centerX: point.centerX,
        centerY: point.centerY,
        chipRadius: point.chipRadius,
        labelX: selected.x,
        labelY: selected.y,
        labelFontSize: point.labelFontSize,
        labelWidth: point.labelWidth,
        labelHeight: point.labelHeight,
        text: point.text
      });
    }

    setRegionOverlays(nextOverlays);
  }, [screen]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }
    const svg = mapRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    const cleanups: Array<() => void> = [];
    for (const territory of worldClassic.map.territories) {
      const node = svg.querySelector(`#${CSS.escape(territory.id)}`) as SVGElement | null;
      if (!node) {
        continue;
      }
      node.classList.add("territory-region");
      node.setAttribute("data-territory-id", territory.id);
      const onClick = (event: Event) => {
        event.stopPropagation();
        handleTerritoryClick(territory.id);
      };
      const onMouseEnter = () => setHoverTerritoryId(territory.id);
      const onMouseLeave = () => setHoverTerritoryId(current => (current === territory.id ? "" : current));
      node.addEventListener("click", onClick);
      node.addEventListener("mouseenter", onMouseEnter);
      node.addEventListener("mouseleave", onMouseLeave);
      cleanups.push(() => {
        node.removeEventListener("click", onClick);
        node.removeEventListener("mouseenter", onMouseEnter);
        node.removeEventListener("mouseleave", onMouseLeave);
      });
    }

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [handleTerritoryClick, screen]);

  useEffect(() => {
    if (screen !== "game" || !state) {
      return;
    }
    const svg = mapRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    for (const territory of worldClassic.map.territories) {
      const node = svg.querySelector(`#${CSS.escape(territory.id)}`) as SVGElement | null;
      if (!node) {
        continue;
      }
      const territoryState = state.territories[territory.id];
      const ownerColor = territoryState ? (playerColorById[territoryState.ownerPlayerId] ?? "#8ca0b2") : "#8ca0b2";
      node.style.setProperty("--owner-color", ownerColor);
      node.classList.toggle("territory-owned", !!territoryState);
      node.classList.toggle("territory-owned-self", territoryState?.ownerPlayerId === playerId);
      node.classList.toggle("territory-setup-owned", currentPhase === "setup" && territoryState?.ownerPlayerId === playerId);
      node.classList.toggle(
        "territory-selected-reinforce",
        (currentPhase === "setup" || currentPhase === "reinforcement") && territory.id === reinforceTerritoryId
      );
      node.classList.toggle("territory-attack-source", currentPhase === "attack" && isMyTurn && attackSourceIdSet.has(territory.id));
      node.classList.toggle("territory-selected-source", currentPhase === "attack" && territory.id === attackFromId);
      node.classList.toggle("territory-selected-target", currentPhase === "attack" && territory.id === attackToId);
      node.classList.toggle("territory-attack-target", currentPhase === "attack" && possibleAttackTargetIds.has(territory.id));
      node.classList.toggle("territory-selected-fortify-source", currentPhase === "fortify" && territory.id === fortifyFromId);
      node.classList.toggle("territory-selected-fortify-target", currentPhase === "fortify" && territory.id === fortifyToId);
    }
  }, [
    attackFromId,
    attackSourceIdSet,
    attackToId,
    currentPhase,
    fortifyFromId,
    fortifyToId,
    isMyTurn,
    playerColorById,
    playerId,
    possibleAttackTargetIds,
    reinforceTerritoryId,
    screen,
    state
  ]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const computeMinScale = () => {
      const viewport = mapViewportRef.current;
      const svg = mapRef.current?.querySelector("svg") as SVGSVGElement | null;
      if (!viewport || !svg) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      if (viewportRect.width <= 0 || viewportRect.height <= 0 || svgRect.width <= 0 || svgRect.height <= 0) {
        return;
      }

      const safeScale = Math.max(0.001, mapScale);
      const baseWidth = svgRect.width / safeScale;
      const baseHeight = svgRect.height / safeScale;
      if (baseWidth <= 0 || baseHeight <= 0) {
        return;
      }

      const fitScale = Math.max(viewportRect.width / baseWidth, viewportRect.height / baseHeight);
      const nextMin = clamp(fitScale, 0.6, 2.2);
      setMapMinScale(previous => (Math.abs(previous - nextMin) < 0.005 ? previous : nextMin));
      setMapScale(previous => (previous < nextMin ? nextMin : previous));
    };

    const rafId = window.requestAnimationFrame(computeMinScale);
    const resizeHandler = () => computeMinScale();
    window.addEventListener("resize", resizeHandler);
    const intervalId = window.setInterval(computeMinScale, 400);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeHandler);
      window.clearInterval(intervalId);
    };
  }, [mapScale, screen]);

  const createLobby = async () => {
    try {
      const payload = await postJson<CreateRoomResponse>(`${hostUrl}/api/rooms`, {
        hostPeerId: hostPeerId.trim(),
        hostDisplayName: hostDisplayName.trim(),
        mapId: "world-classic",
        roomName: roomName.trim()
      });
      setRoomId(payload.roomId);
      setPeerId(hostPeerId.trim());
      setPlayerId(hostPeerId.trim());
      setRoomSnapshot({
        roomId: payload.roomId,
        roomName: payload.roomName,
        hostPeerId: payload.hostPeerId,
        mapId: payload.mapId,
        status: payload.status,
        activeMatchId: null,
        participants: payload.participants
      });
      setStatus(`Lobby creata: ${payload.roomName} (${payload.roomId})`);
      setScreen("hostLobby");
    } catch (error) {
      setStatus(`Creazione lobby fallita: ${(error as Error).message}`);
    }
  };

  const joinLobby = async (selectedRoomId: string) => {
    try {
      const payload = await postJson<JoinRoomResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(selectedRoomId)}/join`, {
        peerId: joinPeerId.trim(),
        displayName: joinDisplayName.trim()
      });
      setRoomId(payload.roomId);
      setPeerId(joinPeerId.trim());
      setPlayerId(joinPeerId.trim());
      setRoomSnapshot({
        roomId: payload.roomId,
        roomName: payload.roomName,
        hostPeerId: payload.hostPeerId,
        mapId: payload.mapId,
        status: payload.status,
        activeMatchId: payload.activeMatchId ?? null,
        participants: payload.participants
      });
      setStatus(`Entrato nella lobby: ${payload.roomName}`);
      if (payload.activeMatchId) {
        setMatchId(payload.activeMatchId);
        setSyncOn(true);
        setScreen("game");
      } else {
        setScreen("joinLobby");
      }
    } catch (error) {
      setStatus(`Ingresso fallito: ${(error as Error).message}`);
    }
  };

  const startMatch = async () => {
    if (!roomId) {
      setStatus("Nessuna lobby selezionata.");
      return;
    }
    try {
      const payload = await postJson<StartMatchResponse>(`${hostUrl}/api/rooms/${encodeURIComponent(roomId)}/start`, {
        hostPeerId: hostPeerId.trim(),
        mapId: "world-classic",
        rngSeed: 12345
      });
      setMatchId(payload.matchId);
      setSyncOn(true);
      setScreen("game");
      setStatus(`Partita avviata: ${payload.matchId}`);
    } catch (error) {
      setStatus(`Avvio fallito: ${(error as Error).message}`);
    }
  };

  const submitCommand = async (type: string, payload: Record<string, unknown>) => {
    if (!matchId || !playerId || !peerId) {
      setStatus("ID partita, ID peer e ID giocatore sono obbligatori.");
      return;
    }
    try {
      const response = await fetch(`${hostUrl}/api/matches/${encodeURIComponent(matchId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId,
          type,
          payload: {
            playerId,
            commandId: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ...payload
          }
        })
      });
      const text = await response.text();
      let body: SubmitCommandResponse | null = null;
      if (text) {
        body = JSON.parse(text) as SubmitCommandResponse;
      }
      if (!response.ok || !body || !body.accepted) {
        const code = body?.errorCode ?? -1;
        const message = body?.message ?? `HTTP ${response.status}`;
        setStatus(`Comando rifiutato (${code} - ${commandErrorLabel(code)}): ${message}`);
        return;
      }
      setStatus(`Comando accettato (${commandLabel(type)}): ${body.appliedEventCount} eventi.`);
    } catch (error) {
      setStatus(`Errore comando: ${(error as Error).message}`);
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) {
      return;
    }
    setChatMessages(current => [
      ...current,
      { id: Date.now(), author: playerId || peerId || "giocatore", text, at: new Date().toLocaleTimeString() }
    ]);
    setChatInput("");
  };

  const zoomBy = (delta: number) => {
    setMapScale(current => clamp(current + delta, mapMinScale, 3));
  };

  const renderObjectiveCard = (compact = false) => (
    <div className={`objective-svg-card ${compact ? "compact" : "reveal"}`}>
      <div className="objective-svg-surface" dangerouslySetInnerHTML={{ __html: OBJECTIVE_CARD_BASE }} />
      <div className="objective-svg-overlay">
        <h4>{myObjective?.title ?? "Carta Obiettivo"}</h4>
        <p>{myObjective?.description ?? "Obiettivo assegnato."}</p>
      </div>
    </div>
  );

  const renderTerritoryCard = (territoryId: string) => {
    const svg = svgForTerritoryCard(territoryId);
    if (!svg) {
      return (
        <div className="hand-card">
          <span className="hand-card-short">{labelForTerritory(territoryId).slice(0, 3).toUpperCase()}</span>
          <span className="hand-card-full">{labelForTerritory(territoryId)}</span>
        </div>
      );
    }
    return <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: svg }} />;
  };

  const renderFlipCard = (front: JSX.Element, back: JSX.Element, className = "", animationDelayMs = 0) => {
    const style = { ["--flip-delay-ms" as string]: `${animationDelayMs}ms` } as CSSProperties;
    return (
      <div className={`flip-card ${className}`.trim()} style={style}>
        <div className="flip-card-inner">
          <div className="flip-face flip-back">{back}</div>
          <div className="flip-face flip-front">{front}</div>
        </div>
      </div>
    );
  };

  if (screen === "splash") {
    return (
      <main className="splash-shell">
        <div className="splash-card">
          <h1>RisiKo!</h1>
          <p>Partita Obiettivo in rete</p>
          <div className="splash-loader" />
        </div>
      </main>
    );
  }

  if (screen === "portal") {
    return (
      <main className="menu-shell">
        <section className="menu-hero">
          <h1>Lobby RisiKo!</h1>
          <p>L'host crea una lobby. Chi entra vede la lista server e si unisce con un clic.</p>
        </section>
        <section className="menu-grid">
          <article className="menu-card">
            <h2>Crea Lobby</h2>
            <label className="field">
              URL host
              <input value={hostUrl} onChange={event => setHostUrl(event.target.value)} />
            </label>
            <label className="field">
              Nome lobby
              <input value={roomName} onChange={event => setRoomName(event.target.value)} />
            </label>
            <label className="field">
              Nome host
              <input value={hostDisplayName} onChange={event => setHostDisplayName(event.target.value)} />
            </label>
            <label className="field">
              Peer ID host
              <input value={hostPeerId} onChange={event => setHostPeerId(event.target.value)} />
            </label>
            <button type="button" className="btn-primary" onClick={createLobby}>
              Crea lobby
            </button>
          </article>
          <article className="menu-card">
            <h2>Entra</h2>
            <label className="field">
              Nome giocatore
              <input value={joinDisplayName} onChange={event => setJoinDisplayName(event.target.value)} />
            </label>
            <label className="field">
              Peer ID giocatore
              <input value={joinPeerId} onChange={event => setJoinPeerId(event.target.value)} />
            </label>
            <div className="menu-button-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const rooms = await getJson<RoomLobbySummary[]>(`${hostUrl}/api/rooms`);
                    setAvailableRooms(rooms.filter(room => room.status === "open"));
                  } catch (error) {
                    setStatus(`Errore elenco stanze: ${(error as Error).message}`);
                  }
                }}
              >
                Aggiorna stanze
              </button>
            </div>
            <ul className="participants-list">
              {availableRooms.length === 0 ? <li>Nessuna lobby aperta.</li> : null}
              {availableRooms.map(room => (
                <li key={room.roomId}>
                  <strong>{room.roomName}</strong> <code>{room.roomId}</code> ({room.playerCount}/{room.maxPlayers})
                  <div className="button-row">
                    <button type="button" className="btn-secondary" onClick={() => joinLobby(room.roomId)}>
                      Entra
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
        <footer className="menu-status">{status}</footer>
      </main>
    );
  }

  if (screen === "hostLobby" || screen === "joinLobby") {
    return (
      <main className="menu-shell">
        <section className="menu-hero">
          <h1>{roomSnapshot?.roomName ?? "Lobby"}</h1>
          <p>
            Stanza: <code>{roomId}</code> | Host: <code>{roomSnapshot?.hostPeerId ?? "-"}</code>
          </p>
        </section>
        <section className="menu-grid">
          <article className="menu-card">
            <h2>Giocatori</h2>
            <ul className="participants-list">
              {(roomSnapshot?.participants ?? []).map(participant => (
                <li key={participant.peerId}>
                  {participant.displayName} <code>{participant.peerId}</code>
                </li>
              ))}
            </ul>
            <p>Minimo giocatori per iniziare: 2</p>
            <p>Attuali: {roomSnapshot?.participants.length ?? 0}</p>
          </article>
          <article className="menu-card">
            <h2>Controlli lobby</h2>
            <label className="field">
              URL host
              <input value={hostUrl} onChange={event => setHostUrl(event.target.value)} />
            </label>
            <label className="field">
              ID peer
              <input value={peerId} onChange={event => setPeerId(event.target.value)} />
            </label>
            <label className="field">
              ID giocatore
              <input value={playerId} onChange={event => setPlayerId(event.target.value)} />
            </label>
            <div className="menu-button-row">
              <button
                type="button"
                className="btn-primary"
                onClick={startMatch}
                disabled={!isHostInLobby || (roomSnapshot?.participants.length ?? 0) < 2}
              >
                Avvia partita
              </button>
              <button type="button" className="btn-secondary" onClick={() => setScreen("portal")}>
                Indietro
              </button>
            </div>
            {!isHostInLobby ? <p>In attesa che l'host avvii la partita...</p> : null}
          </article>
        </section>
        <footer className="menu-status">{status}</footer>
      </main>
    );
  }

  return (
    <main className="arena-shell">
      <div className="arena-map-layer">
        <div
          ref={mapViewportRef}
          className="arena-map-viewport"
          onWheel={event => {
            event.preventDefault();
            zoomBy(event.deltaY > 0 ? -0.08 : 0.08);
          }}
          onMouseDown={event => {
            setIsPanning(true);
            setPanStart({ x: event.clientX - mapOffset.x, y: event.clientY - mapOffset.y });
          }}
          onMouseMove={event => {
            if (!isPanning) {
              return;
            }
            setMapOffset({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
          onClick={event => {
            const target = event.target as Element | null;
            if (target?.closest("[data-territory-id]")) {
              return;
            }
            clearMapSelections();
          }}
        >
          <div className="arena-map-stage" style={{ transform: `translate(calc(-50% + ${mapOffset.x}px), calc(-50% + ${mapOffset.y}px)) scale(${mapScale})` }}>
            <div ref={mapRef} className="map-canvas arena-map" dangerouslySetInnerHTML={{ __html: worldClassic.svg }} />
            <svg className="map-owner-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
              {regionOverlays.map(overlay => {
                const territory = state?.territories?.[overlay.id];
                if (!territory) {
                  return null;
                }
                const ownerColor = playerColorById[territory.ownerPlayerId] ?? "#7f92a5";
                return (
                  <g key={`owner-${overlay.id}`} className="map-owner-chip" transform={`translate(${overlay.centerX} ${overlay.centerY})`}>
                    <circle cx="0" cy="0" r={overlay.chipRadius} fill={ownerColor} />
                    <text x="0" y="0" style={{ fontSize: `${Math.max(8, overlay.chipRadius * 1.05)}px` }}>
                      {territory.armies}
                    </text>
                  </g>
                );
              })}
            </svg>
            <svg className="map-label-overlay" viewBox={mapViewBox} preserveAspectRatio="xMidYMid meet">
              {regionOverlays.map(overlay => (
                <text key={overlay.id} x={overlay.labelX} y={overlay.labelY} style={{ fontSize: `${overlay.labelFontSize}px` }}>
                  {overlay.text}
                </text>
              ))}
            </svg>
          </div>
          <div className="map-zoom-tools">
            <button type="button" className="btn-secondary" onClick={() => zoomBy(0.12)}>
              +
            </button>
            <button type="button" className="btn-secondary" onClick={() => zoomBy(-0.12)}>
              -
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setMapScale(mapMinScale); setMapOffset({ x: 0, y: 0 }); }}>
              Reimposta
            </button>
          </div>
        </div>
      </div>

      <header className="arena-topbar">
        <div className="turn-banner">
          <strong>{state?.turnIndex ?? "-"}</strong> | {isMyTurn ? "Il tuo turno" : `Turno di: ${activePlayerLabel}`} | Fase:{" "}
          {phaseLabel(currentPhase)}
        </div>
        <button type="button" className="btn-secondary" onClick={() => setScreen("portal")}>
          Esci
        </button>
      </header>

      <aside className="arena-left">
        <ul className="player-token-list">
          {playerRows.map(row => (
            <li key={row.player.playerId} className={`player-token ${row.player.playerId === state?.activePlayerId ? "is-active-player" : ""}`}>
              <div className="player-card-tab">
                <img
                  src={row.cardAsset}
                  alt={`Carta giocatore ${row.player.displayName}`}
                  className="player-card-image"
                  draggable={false}
                />
                <span className="player-card-chip" style={{ backgroundColor: row.color }}>
                  {row.player.displayName.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="player-hover-card">
                <strong>{row.player.displayName}</strong> <code>{row.player.playerId}</code>
                <p>Territori: {row.owned}</p>
                <p>Carte: {row.cardCount}</p>
                <p>Piazzabili ora: {row.placeableNow}</p>
                <p>Prossimo turno: {row.nextRound}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <aside className="arena-right">
        <section className="arena-panel-card">
          <h3>Stato Partita</h3>
          <p className="muted small-gap">Territorio sotto cursore: <strong>{hoveredTerritoryLabel}</strong></p>
          <p className="muted small-gap">Tuo turno: <strong>{isMyTurn ? "Si" : "No"}</strong></p>
          <p className="muted small-gap">Fase: <strong>{phaseLabel(currentPhase)}</strong></p>
        </section>

        <section className="arena-panel-card">
          <h3>Chat</h3>
          <div className="chat-log">
            {chatMessages.length === 0 ? <p className="muted">Nessun messaggio.</p> : null}
            {chatMessages.map(message => (
              <p key={message.id}>
                <strong>{message.author}</strong> [{message.at}]<br />
                {message.text}
              </p>
            ))}
          </div>
          <div className="chat-send">
            <input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Scrivi un messaggio..." />
            <button type="button" className="btn-secondary" onClick={sendChatMessage}>
              Invia
            </button>
          </div>
        </section>

        <section className="action-stack compact arena-panel-card">
          <h3>Azioni</h3>
          <p className="phase-help">{phaseInstruction}</p>
          <label className="field">
            Rinforza
            <select value={reinforceTerritoryId} onChange={event => setReinforceTerritoryId(event.target.value)}>
              {ownedTerritories.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row reinforce-stepper">
            <button
              type="button"
              className="btn-secondary stepper-btn"
              onClick={() => setReinforceArmies(current => Math.max(1, current - 1))}
              disabled={!isMyTurn || (currentPhase !== "reinforcement" && currentPhase !== "setup") || reinforceArmies <= 1}
            >
              -
            </button>
            <span className="stepper-value">{reinforceArmies}</span>
            <button
              type="button"
              className="btn-secondary stepper-btn"
              onClick={() => setReinforceArmies(current => Math.min(reinforceMax, current + 1))}
              disabled={!isMyTurn || (currentPhase !== "reinforcement" && currentPhase !== "setup") || reinforceArmies >= reinforceMax}
            >
              +
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitCommand("PlaceReinforcements", { territoryId: reinforceTerritoryId, armiesToPlace: reinforceArmies })}
              disabled={!isMyTurn || (currentPhase !== "reinforcement" && currentPhase !== "setup") || !reinforceTerritoryId}
            >
              Piazza
            </button>
          </div>
          <label className="field">
            Attacca
            <select value={attackFromId} onChange={event => setAttackFromId(event.target.value)}>
              {attackSourceOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <select value={attackToId} onChange={event => setAttackToId(event.target.value)}>
              {attackTargetOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <select value={attackDice} onChange={event => setAttackDice(Number(event.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitCommand("Attack", { fromTerritoryId: attackFromId, toTerritoryId: attackToId, attackerDice: attackDice })}
              disabled={!isMyTurn || currentPhase !== "attack" || !attackFromId || !attackToId}
            >
              Attacca
            </button>
          </div>
          <label className="field">
            Fortifica
            <select value={fortifyFromId} onChange={event => setFortifyFromId(event.target.value)}>
              {fortifySourceOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
            <select value={fortifyToId} onChange={event => setFortifyToId(event.target.value)}>
              {fortifyTargetOptions.map(territory => (
                <option key={territory.territoryId} value={territory.territoryId}>
                  {labelForTerritory(territory.territoryId)}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <input type="number" min={1} value={fortifyArmies} onChange={event => setFortifyArmies(Math.max(1, Number(event.target.value) || 1))} />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => submitCommand("Fortify", { fromTerritoryId: fortifyFromId, toTerritoryId: fortifyToId, armiesToMove: fortifyArmies })}
              disabled={!isMyTurn || currentPhase !== "fortify" || !fortifyFromId || !fortifyToId}
            >
              Fortifica
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={() => submitCommand("EndTurn", {})} disabled={!isMyTurn || currentPhase === "setup"}>
            Fine / Prossimo
          </button>
        </section>
        <p className="arena-status">{status}</p>
      </aside>

      <footer className="arena-bottom">
        <div className="hand-strip">
          <div className="hand-title">
            <strong>Le tue carte</strong> ({handCount}) | Obiettivo: {myObjective?.title ?? "-"}{" "}
            {objectiveRemaining !== null ? `| Territori obiettivo mancanti: ${objectiveRemaining}` : ""}
          </div>
          <div className="hand-cards">
            {renderObjectiveCard(true)}
            {setupDeckVisible && dealtTerritoryOrder.length > 0
              ? dealtTerritoryOrder.map(id => (
                  <div key={`setup-${id}`} className="hand-card svg-wrap">
                    {renderTerritoryCard(id)}
                  </div>
                ))
              : null}
            {!setupDeckVisible && myCards.length === 0 ? <span className="muted">Nessuna carta.</span> : null}
            {!setupDeckVisible
              ? myCards.map(cardId => {
                  if (cardId.startsWith("territory:")) {
                    const territoryId = cardId.replace("territory:", "");
                    return (
                      <div key={cardId} className="hand-card svg-wrap">
                        {renderTerritoryCard(territoryId)}
                      </div>
                    );
                  }
                  if (cardId.startsWith("joker")) {
                    return (
                      <div key={cardId} className="hand-card svg-wrap">
                        <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: jokerCardRaw }} />
                      </div>
                    );
                  }
                  return (
                    <div key={cardId} className="hand-card">
                      <span className="hand-card-short">{prettyCardName(cardId).slice(0, 3).toUpperCase()}</span>
                      <span className="hand-card-full">{prettyCardName(cardId)}</span>
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </footer>

      {dealStage !== "idle" ? (
        <div className="deal-overlay global">
          {dealStage === "objective" ? (
            <div className="deal-card objective svg no-frame">
              {renderFlipCard(
                renderObjectiveCard(false),
                <div className="objective-svg-card">
                  <div className="objective-svg-surface" dangerouslySetInnerHTML={{ __html: objectiveCardBackRaw }} />
                </div>,
                "flip-in objective"
              )}
              <small>Obiettivo segreto assegnato</small>
            </div>
          ) : null}
          {dealStage === "territories" || dealStage === "complete" ? (
            <div className={`deal-card territories svg ${dealFlyToHand ? "to-hand" : ""}`}>
              <h3>Distribuzione territori</h3>
              <p>{revealedTerritories.length} assegnati</p>
              <div className="deal-territory-stack">
                {revealedTerritories.slice(-9).map((id, index) => (
                  <div
                    key={`deal-${id}-${index}`}
                    className="deal-territory-card"
                    style={{ transform: `translate(${index * 3}px, ${index * 1.5}px) rotate(${(index - 4) * 1.1}deg)` }}
                  >
                    {svgForTerritoryCard(id)
                      ? renderFlipCard(
                          <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: svgForTerritoryCard(id)! }} />,
                          <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: territoryCardBackRaw }} />,
                          "flip-in territory",
                          index * 85
                        )
                      : renderFlipCard(
                          <div className="deal-territory-fallback">{escapeHtml(labelForTerritory(id))}</div>,
                          <div className="territory-svg-card" dangerouslySetInnerHTML={{ __html: territoryCardBackRaw }} />,
                          "flip-in territory",
                          index * 85
                        )}
                  </div>
                ))}
              </div>
              {dealStage === "complete" ? <small>Le carte scorrono nella tua mano...</small> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export default App;


