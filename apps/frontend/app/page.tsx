import { Cena } from '../components/cena/Cena';
import { CENA_INICIO } from '../components/cena/dados';
import { MenuInicio } from './MenuInicio';
import estilos from './inicio.module.css';

// Tela "Inicio - Desktop" do Figma (Telas v2).
export default function Inicio() {
  return (
    <main>
      <Cena dados={CENA_INICIO}>
        <h1 className={estilos.titulo}>
          <span className={estilos.tituloSombra} aria-hidden="true">
            CRONARCA
          </span>
          <span className={estilos.tituloLuz}>CRONARCA</span>
        </h1>
        <p className={estilos.subtitulo}>Crônicas de um reino por erguer</p>
        <span className={estilos.fio} style={{ left: 520 }} aria-hidden="true" />
        <span className={estilos.fio} style={{ left: 760 }} aria-hidden="true" />
        <span className={estilos.losango} aria-hidden="true" />
        <MenuInicio />
      </Cena>
    </main>
  );
}
