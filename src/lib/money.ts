export const MONEY_INPUT_HINT = 'Nhập theo nghìn đồng: 1200 = 1.200.000đ';

export const parseThousandVndInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatVndFromThousands = (value: string | number | null | undefined) => {
  const thousands = parseThousandVndInput(value);
  return `${(thousands * 1000).toLocaleString('vi-VN')}đ`;
};

export const formatCompactVndFromThousands = (value: string | number | null | undefined) => {
  const amount = parseThousandVndInput(value) * 1000;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} triệu`;
  return `${amount.toLocaleString('vi-VN')}đ`;
};
