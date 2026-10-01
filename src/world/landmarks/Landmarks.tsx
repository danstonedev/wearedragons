import { useFrame } from "@react-three/fiber";
import { gameSession } from "../../game/runtime";
import { Aurora, FrozenLake, IcePalace, SkyPalace, Volcano } from "./FireAndIce";
import { Citadel, HiveTowers, MudVillage, ScorpionDen } from "./Settlements";
import { GreatFalls, MudPools, Oasis } from "./Waters";
import { FallenGiant, GreatArch, RainforestGiants, SeaStacks } from "./Wonders";
import { landmarkTime } from "./shaders";
import RoyalHoards from "./RoyalHoards";

/** Every kingdom's landmarks; must sit inside <Physics> for their colliders. */
export default function Landmarks() {
  useFrame((_, delta) => {
    if (!gameSession.paused) landmarkTime.value += Math.min(delta, 0.1);
  });
  return <>
    <Volcano />
    <SkyPalace />
    <IcePalace />
    <FrozenLake />
    <Aurora />
    <MudPools />
    <MudVillage />
    <GreatFalls />
    <RainforestGiants />
    <Oasis />
    <ScorpionDen />
    <GreatArch />
    <FallenGiant />
    <HiveTowers />
    <Citadel />
    <SeaStacks />
    <RoyalHoards />
  </>;
}
