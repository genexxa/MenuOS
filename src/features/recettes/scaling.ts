/** Met à l’échelle une quantité de base pour un nombre de portions cible. */
export function scaleQuantity(quantite: number, portionsBase: number, portionsCible: number): number {
  if (portionsBase <= 0) return quantite
  const scaled = (quantite * portionsCible) / portionsBase
  return Math.round(scaled * 100) / 100
}
