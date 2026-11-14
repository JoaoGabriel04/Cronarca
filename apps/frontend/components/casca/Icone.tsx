// Ícone de sprite (Sprite/Icone, 16 px) em escala inteira, sem suavizar.
import estilos from './casca.module.css';

export function Icone({ nome, tamanho = 32, className = '' }: { nome: string; tamanho?: 16 | 32; className?: string }) {
  return (
    // Sprite 1x ampliado em inteiro pelo navegador (pixelated): o otimizador de imagem do Next não serve aqui.
    <img className={`${estilos.pixel} ${className}`} src={`/icones/${nome}.png`} width={tamanho} height={tamanho} alt="" draggable={false} />
  );
}
