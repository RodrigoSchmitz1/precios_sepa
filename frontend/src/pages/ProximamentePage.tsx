type Props = {
  titulo: string;
};

function ProximamentePage({ titulo }: Props) {
  return (
    <div className="max-w-3xl mx-auto text-center py-20">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">{titulo}</h1>
      <p className="text-gray-500">
        Esta seccion esta en construccion. Pronto vas a poder verla aca.
      </p>
    </div>
  );
}

export default ProximamentePage;
