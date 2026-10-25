import { type Data } from "../domain/model";
import { validateData } from "../domain/backup";
export class SharedDataError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type State = {
  data: Data;
  revision: number;
  updatedAt: string | null;
  viewer: { displayName: string; email: string };
};
export class SharedRepository {
  private state: State | null = null;
  get metadata() {
    return this.state;
  }
  async read(): Promise<Data> {
    const response = await fetch("/api/household", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw await this.error(response);
    const state = (await response.json()) as State;
    state.data = validateData(state.data);
    this.state = state;
    return state.data;
  }
  async replace(data: Data, expected?: Data) {
    if (!this.state)
      throw new Error("Load the shared household before saving.");
    if (
      expected &&
      JSON.stringify(expected) !== JSON.stringify(this.state.data)
    )
      throw new Error(
        "Records changed while you were editing. Cancel your edit, refresh, and try again.",
      );
    const response = await fetch("/api/household", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "If-Match": `"${this.state.revision}"`,
      },
      body: JSON.stringify({ data: validateData(data) }),
    });
    if (!response.ok) throw await this.error(response);
  }
  private async error(response: Response) {
    let message = "The shared service could not be reached.";
    try {
      message =
        ((await response.json()) as { error?: string }).error ?? message;
    } catch {}
    return new SharedDataError(message, response.status);
  }
}
export const db = new SharedRepository();
