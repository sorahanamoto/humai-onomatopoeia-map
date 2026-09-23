import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl, type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Coordinates, OnomatopoeiaRecord } from '../types'

type Props = {
  coordinates: Coordinates | null
  records: OnomatopoeiaRecord[]
}

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim()
setWorkerUrl(workerUrl)
const styleUrl = mapTilerKey
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
  : 'https://demotiles.maplibre.org/style.json'

export function MapView({ coordinates, records }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const currentMarkerRef = useRef<Marker | null>(null)
  const recordMarkersRef = useRef<Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [139.7671, 35.6812],
      zoom: 14,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !coordinates) return

    const lngLat: [number, number] = [coordinates.longitude, coordinates.latitude]
    map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 16), essential: true })

    if (!currentMarkerRef.current) {
      const markerElement = document.createElement('div')
      markerElement.className = 'current-location-marker'
      markerElement.setAttribute('aria-label', '現在地')
      currentMarkerRef.current = new maplibregl.Marker({ element: markerElement })
        .setLngLat(lngLat)
        .addTo(map)
    } else {
      currentMarkerRef.current.setLngLat(lngLat)
    }
  }, [coordinates])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    recordMarkersRef.current.forEach((marker) => marker.remove())
    recordMarkersRef.current = records.map((record) => {
      const element = document.createElement('button')
      element.className = 'onomatopoeia-marker'
      element.textContent = record.onomatopoeia
      element.type = 'button'
      element.setAttribute('aria-label', `${record.onomatopoeia}の記録`)
      return new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([record.longitude, record.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${escapeHtml(record.onomatopoeia)}</strong>${record.description ? `<p>${escapeHtml(record.description)}</p>` : ''}`,
          ),
        )
        .addTo(map)
    })
  }, [records])

  return <div className="map" ref={containerRef} aria-label="オノマトペ記録地図" />
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character]
  })
}
