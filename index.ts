import WebSocket from "ws";
import Controlador from "./src/contolador.ts";

const url = `${
  process.env.STREAM_URL_PROD
}/${process.env.SYMBOL?.toLowerCase()}@ticker`;

const ws = new WebSocket(url);

ws.on("message", (ev) => {
  console.clear();
  const Obj = JSON.parse(ev.toString());

  if (Obj && Obj.s && Obj.a) {
    console.log("🚀 ~ SIMBOL: ", Obj.s);
    console.log("🚀 ~ MELHOR PREÇO DE VENDA: ", Obj.a);
    console.log(
      "🚀 ~ ",
      `${new Date().toLocaleDateString(
        "pt-BR"
      )} as ${new Date().toLocaleTimeString("pt-BR")}`
    );

    const valor_atual = parseFloat(Obj.a || "0");
    Controlador(valor_atual);
  }
});
