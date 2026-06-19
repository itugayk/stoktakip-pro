"use server";

import { withAuth, ok, parseInput, z, ERR } from "@/lib/server";

const expenseCategoryEnum = z.enum([
  "rent",
  "salary",
  "utilities",
  "logistics",
  "tax",
  "other",
]);
const paymentMethodEnum = z.enum([
  "cash",
  "card",
  "bank_transfer",
  "credit",
  "check",
  "other",
]);

export interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  description: string | null;
  paymentMethod: string;
}

export const listExpenses = withAuth<
  { from?: string; to?: string } | undefined,
  ExpenseRow[]
>(async (ctx, filters) => {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters?.from) dateFilter.gte = new Date(filters.from);
  if (filters?.to) dateFilter.lte = new Date(filters.to);

  const rows = await ctx.prisma.expense.findMany({
    where: {
      companyId: ctx.companyId,
      ...(Object.keys(dateFilter).length ? { expenseDate: dateFilter } : {}),
    },
    orderBy: { expenseDate: "desc" },
    take: 300,
  });

  return ok(
    rows.map((e) => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount),
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
      description: e.description,
      paymentMethod: e.paymentMethod,
    }))
  );
});

const createExpenseSchema = z.object({
  category: expenseCategoryEnum.default("other"),
  amount: z.number().positive("Tutar 0'dan büyük olmalı"),
  expenseDate: z.string().optional(),
  description: z.string().optional(),
  paymentMethod: paymentMethodEnum.default("cash"),
});

export const createExpense = withAuth<
  z.input<typeof createExpenseSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(createExpenseSchema, raw);
  const e = await ctx.prisma.expense.create({
    data: {
      companyId: ctx.companyId,
      category: data.category,
      amount: data.amount,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      description: data.description ?? null,
      paymentMethod: data.paymentMethod,
      userId: ctx.userId,
    },
    select: { id: true },
  });
  return ok(e);
});

export const deleteExpense = withAuth<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.expense.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Gider");
  return ok();
});
