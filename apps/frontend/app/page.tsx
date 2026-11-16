import { preload } from 'react-dom';
import { Cena } from '../components/cena/Cena';
import { MARCA } from '../lib/marca';
import { CENA_INICIO } from '../components/cena/dados';
import { MenuInicio } from './MenuInicio';
import estilos from './inicio.module.css';

// Tela "Inicio - Desktop" do Figma (Telas v2).
export default function Inicio() {
  // A logo chega cedo (alta prioridade) sem segurar a primeira pintura; o tamanho fixo evita salto.
  preload(MARCA.logo.src, { as: 'image', fetchPriority: 'high' });
  return (
    <main>
      <Cena dados={CENA_INICIO}>
        <h1 className={estilos.titulo}>
          {/* Logo a 6 px do palco por pixel da arte: --u px de tela, sempre inteiro. */}
          <img
            className={estilos.logo}
            src={MARCA.logo.src}
            width={MARCA.logo.largura}
            height={MARCA.logo.altura}
            alt={MARCA.nome}
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </h1>
        <p className={estilos.subtitulo}>Crônicas de um reino por erguer</p>
        <span className={estilos.fio} style={{ left: 520 }} aria-hidden="true" />
        <span className={estilos.fio} style={{ left: 780 }} aria-hidden="true" />
        <span className={estilos.losango} aria-hidden="true" />
        <MenuInicio />
      </Cena>
    </main>
  );
}
