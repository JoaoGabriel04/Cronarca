import { Suspense } from 'react';
import { Cena } from '../../components/cena/Cena';
import { CENA_LOGIN } from '../../components/cena/dados';
import { CartaoLogin } from './CartaoLogin';
import estilos from './login.module.css';

export const metadata = { title: 'Entrar · Cronarca' };

// Tela "Login - Desktop" do Figma (Telas v2), com as decisões do Portão 3:
// sem "Jogar sem conta", com Google e Discord, sem "Esqueci a senha" por ora.
export default function Login() {
  return (
    <main>
      <Cena dados={CENA_LOGIN}>
        <p className={estilos.marca}>CRONARCA</p>
        <p className={estilos.lema}>“Todo reino começa com uma fogueira.”</p>
        <Suspense>
          <CartaoLogin />
        </Suspense>
      </Cena>
    </main>
  );
}
