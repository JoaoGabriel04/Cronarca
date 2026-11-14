import { Suspense } from 'react';
import { Cena } from '../../components/cena/Cena';
import { CENA_LOGIN } from '../../components/cena/dados';
import { CartaoLogin } from './CartaoLogin';
import { AjusteTeclado } from '../../lib/cena/teclado';
import estilos from './login.module.css';
import { MARCA } from '../../lib/marca';

export const metadata = { title: 'Entrar' };

// Tela "Login - Desktop" do Figma (Telas v2), com as decisões do Portão 3:
// sem "Jogar sem conta", com Google e Discord, sem "Esqueci a senha" por ora.
export default function Login() {
  return (
    <main>
      <Cena dados={CENA_LOGIN}>
        <img
          className={estilos.marca}
          src={MARCA.logo.src}
          width={MARCA.logo.largura}
          height={MARCA.logo.altura}
          alt={MARCA.nome}
          draggable={false}
        />
        <p className={estilos.lema}>“Todo reino começa com uma fogueira.”</p>
        <Suspense>
          <CartaoLogin />
        </Suspense>
        <AjusteTeclado />
      </Cena>
    </main>
  );
}
