import { redirect } from "next/navigation";

import Playing from "@/components/Playing";
import Waiting from "@/components/Waiting";

const page = () => {
  const start = true;

  if (start) {
    return <Playing />;
  }

  return <Waiting />;
};

export default page;
