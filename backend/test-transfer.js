const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({ where: { email: 'test@test.com' }});
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret');
  
  const villages = await prisma.village.findMany({ where: { userId: user.id } });
  if(villages.length < 2) return console.log("Not enough villages");

  const originId = villages[0].id;
  const targetId = villages[1].id;

  const res = await fetch('http://localhost:8080/village/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ originId, targetId, spear: 5, sword: 0, axe: 0 })
  });

  const body = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", body);
}
run().finally(() => prisma.$disconnect());
