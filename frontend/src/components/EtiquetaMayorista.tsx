/** "mayorista" al lado del nombre de una cadena: para quien no compra por
 *  bulto, ese precio no es el de su super de siempre. */
function EtiquetaMayorista({ sobreColor = false }: { sobreColor?: boolean }) {
  return (
    <span
      className={`inline-block align-middle ml-1.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${
        sobreColor ? "bg-white/20 text-white" : "bg-[#fff1db] text-aviso"
      }`}
    >
      mayorista
    </span>
  );
}

export default EtiquetaMayorista;
