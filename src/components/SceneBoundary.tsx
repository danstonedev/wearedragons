import { Component } from "react";
import type { ReactNode } from "react";

/** Keep navigation available if WebGL or an asset cannot load. */
export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="scene-unavailable" role="alert">
      <h2>The 3D scene could not start</h2>
      <p>Enable hardware acceleration and WebGL, then reload. If assets failed to load, check the connection.</p>
    </div> : this.props.children;
  }
}
