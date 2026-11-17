import { randomInt } from 'node:crypto';
import { criarApp } from './app.ts';
import { agendarLimpeza } from './auth/limpeza.ts';
import { provedoresDoEnv } from './auth/oauth.ts';
import { cloudinaryDoEnv } from './avatar/cloudinary.ts';
import { CONFIG_AUTH } from './config.ts';
import { criarPrisma, verificadorDoBanco } from './db.ts';
import { carregarEnv } from './env.ts';

const env = carregarEnv();
const prisma = criarPrisma(env.DATABASE_URL);
const provedores = provedoresDoEnv(env);
const cloudinary = cloudinaryDoEnv(env);

const app = criarApp({
  prisma,
  verificarBanco: verificadorDoBanco(prisma),
  appUrl: env.APP_URL,
  producao: env.NODE_ENV === 'production',
  provedores,
  cloudinary,
  bcryptCusto: CONFIG_AUTH.bcryptCusto,
  limiteConvidadoIp: env.LIMITE_CONVIDADO_IP === 'ligado',
  agora: () => new Date(),
  sortearSemente: () => randomInt(0, 2 ** 32),
});

let pararLimpeza: () => void = () => {};
const servidor = app.listen(env.PORT, '0.0.0.0', () => {
  const ligados = Object.keys(provedores).join(', ') || 'nenhum';
  console.log(`[backend] ouvindo na porta ${env.PORT} (${env.NODE_ENV})`);
  console.log(`[backend] OAuth: ${ligados}; avatar: ${cloudinary ? 'Cloudinary' : 'desligado'}`);
  console.log(`[backend] limite de convidados por IP: ${env.LIMITE_CONVIDADO_IP}`);
  pararLimpeza = agendarLimpeza(prisma, () => new Date());
});

function encerrar(sinal: string) {
  console.log(`[backend] ${sinal} recebido, encerrando`);
  pararLimpeza();
  servidor.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
