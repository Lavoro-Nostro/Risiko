import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

type RootErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends React.Component<React.PropsWithChildren, RootErrorBoundaryState> {
  public constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  public static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown runtime error"
    };
  }

  public override componentDidCatch(error: unknown): void {
    // Keep the error visible in browser devtools.
    // eslint-disable-next-line no-console
    console.error("Root render error:", error);
  }

  public override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main style={{ padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
          <h1>Risiko UI Error</h1>
          <p>The UI crashed while rendering.</p>
          <p>
            <strong>Message:</strong> {this.state.message}
          </p>
          <p>Open browser devtools console for stack details.</p>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
