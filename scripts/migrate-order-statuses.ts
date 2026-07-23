import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { LEGACY_ORDER_STATUS_MAP } from '../src/lib/orderStatus';

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');

async function main() {
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const changes = grouped
    .map(item => ({
      from: item.status,
      to: LEGACY_ORDER_STATUS_MAP[item.status],
      count: item._count._all,
    }))
    .filter(item => item.to && item.from !== item.to);

  if (changes.length === 0) {
    console.log('Không có trạng thái hợp đồng cũ cần chuyển đổi.');
    return;
  }

  console.log(applyChanges ? 'Kế hoạch đang được áp dụng:' : 'Chế độ xem trước, chưa thay đổi dữ liệu:');
  for (const change of changes) {
    console.log(`- ${change.from} -> ${change.to}: ${change.count} hợp đồng`);
  }

  if (!applyChanges) {
    console.log('Chạy lại với --apply sau khi đã kiểm tra và sao lưu database.');
    return;
  }

  await prisma.$transaction(
    changes.map(change => prisma.order.updateMany({
      where: { status: change.from },
      data: { status: change.to },
    })),
  );

  console.log('Đã chuyển đổi trạng thái hợp đồng hiện tại. Lịch sử trạng thái cũ được giữ nguyên để truy dấu.');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
