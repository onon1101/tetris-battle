import Borad from "./borad/Borad";

const playing = () => {
  const gridNumber = Array(10).fill(null);

  return (
    <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-full">
      playing
      <Borad />
    </div>
  );
};

export default playing;
