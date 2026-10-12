import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { listLocomotives, type BackendLocomotive } from "@/lib/api/locomotives";

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: BackendLocomotive[] };

export function useLocomotives() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    listLocomotives()
      .then((data) => setState({ status: "success", data }))
      .catch((err) => {
        setState({
          status: "error",
          error: err instanceof ApiError ? err.message : "Unable to reach the server.",
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
