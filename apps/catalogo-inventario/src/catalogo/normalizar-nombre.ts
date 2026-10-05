// Minúsculas y sin tildes. Se aplica igual al nombre del producto, al cargarlo, que al
// texto que busca el cliente (RF-003).
export function normalizarNombre(nombre: string): string {
  return nombre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
