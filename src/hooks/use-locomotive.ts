import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getLocomotive, type BackendLocomotiveDetail } from "@/lib/api/locomotives";

type State =
  | { status: "loading" }
  | { status: "error"; error: string; notFound: boolean }
  | { status: "success"; data: BackendLocomotiveDetail };

export function useLocomotive(id: string | null) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    if (!id) return;
    setState({ status: "loading" });
    getLocomotive(id)
      .then((data) => setState({ status: "success", data }))
      .catch((err) => {
        setState({
          status: "error",
          error: err instanceof ApiError ? err.message : "Unable to reach the server.",
          notFound: err instanceof ApiError && err.status === 404,
        });
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
