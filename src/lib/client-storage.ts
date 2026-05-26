"use client"

import { del } from "idb-keyval"
import { useAppStore } from "@/store"

export async function clearQazaClientStorage() {
  useAppStore.setState({
    offlineMutations: [],
    userLocation: null,
    calcMethod: 1,
    asrMethod: 0,
    trackWitr: false,
    excusedRanges: [],
    qazaPace: null,
  })

  await Promise.all([
    del("qazatrack-storage"),
    del("qazatrack-query-cache"),
    typeof caches === "undefined"
      ? Promise.resolve()
      : caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  ])
}
