import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Renderer error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 24, color: "#fecaca", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{this.state.error.message}</pre>
          <p style={{ color: "#9ca3af" }}>Open DevTools (View &rarr; Toggle Developer Tools) for the full stack trace.</p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
