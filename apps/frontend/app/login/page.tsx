import { Suspense } from 'react';
import { Cena } from '../../components/cena/Cena';
import { CENA_LOGIN } from '../../components/cena/dados';
import { CartaoLogin } from './CartaoLogin';
import { AjusteTeclado } from '../../lib/cena/teclado';
import estilos from './login.module.css';
import { MARCA } from '../../lib/marca';

export const metadata = { title: 'Entrar' };

// Telas "Login - Desktop" e "Login - Mobile" do Figma (Telas v2): Google e Discord, e "Jogar sem conta" (conta de
// convidado, desabilitada até o Portão B). Sem "Esqueci a senha": não há envio de e-mail; volta com um provedor.
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
