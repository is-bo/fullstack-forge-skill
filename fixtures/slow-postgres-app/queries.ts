// Intentionally flawed N+1 and unbounded read.
const users = await prisma.user.findMany();
for (const user of users) user.orders = await prisma.order.findMany({ where: { userId: user.id } });
