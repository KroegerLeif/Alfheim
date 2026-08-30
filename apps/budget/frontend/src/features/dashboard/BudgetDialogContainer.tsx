"use client";

import React from "react";
import { AccountDialog, accountsApi } from "@/features/accounts";
import { PotDialog, CascadeModal, potsApi } from "@/features/pots";
import { PlanDialog, CategoryDialog, plansApi } from "@/features/plans";
import { QuickAddModal, transactionsApi } from "@/features/transactions";
import {
  Account,
  Pot,
  Plan,
  AccountCreate,
  PotCreate,
  PlanCreate,
  PlanCategoryCreate,
  QuickAddTransactionCreate,
} from "@/features/budget/types";

export interface BudgetDialogContainerProps {
  accountDialogOpen: boolean;
  editingAccount: Account | null;
  onCloseAccountDialog: () => void;

  potDialogOpen: boolean;
  editingPot: Pot | null;
  onClosePotDialog: () => void;

  cascadeModalOpen: boolean;
  onCloseCascadeModal: () => void;

  planDialogOpen: boolean;
  editingPlan: Plan | null;
  planningMode: "monthly" | "event";
  onClosePlanDialog: () => void;

  categoryDialogOpen: boolean;
  categoryParentId: string | null;
  activePlan: Plan | null;
  onCloseCategoryDialog: () => void;

  quickAddOpen: boolean;
  accounts: Account[];
  pots: Pot[];
  plans: Plan[];
  onCloseQuickAdd: () => void;

  onReload: () => void;
}

export function BudgetDialogContainer({
  accountDialogOpen,
  editingAccount,
  onCloseAccountDialog,
  potDialogOpen,
  editingPot,
  onClosePotDialog,
  cascadeModalOpen,
  onCloseCascadeModal,
  planDialogOpen,
  editingPlan,
  planningMode,
  onClosePlanDialog,
  categoryDialogOpen,
  categoryParentId,
  activePlan,
  onCloseCategoryDialog,
  quickAddOpen,
  accounts,
  pots,
  plans,
  onCloseQuickAdd,
  onReload,
}: BudgetDialogContainerProps) {
  return (
    <>
      <AccountDialog
        open={accountDialogOpen}
        account={editingAccount}
        onClose={onCloseAccountDialog}
        onSubmit={async (data: AccountCreate) => {
          if (editingAccount) await accountsApi.updateAccount(editingAccount.id, data);
          else await accountsApi.createAccount(data);
          onReload();
        }}
      />
      <PotDialog
        open={potDialogOpen}
        pot={editingPot}
        onClose={onClosePotDialog}
        onSubmit={async (data: PotCreate) => {
          if (editingPot) await potsApi.updatePot(editingPot.id, data);
          else await potsApi.createPot(data);
          onReload();
        }}
      />
      <CascadeModal
        open={cascadeModalOpen}
        onClose={onCloseCascadeModal}
        onSuccess={onReload}
      />
      <PlanDialog
        open={planDialogOpen}
        plan={editingPlan}
        defaultType={planningMode === "monthly" ? "MONTHLY" : "EVENT"}
        onClose={onClosePlanDialog}
        onSubmit={async (data: PlanCreate) => {
          if (editingPlan) await plansApi.updatePlan(editingPlan.id, data);
          else await plansApi.createPlan(data);
          onReload();
        }}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        parentId={categoryParentId}
        onClose={onCloseCategoryDialog}
        onSubmit={async (data: PlanCategoryCreate) => {
          if (activePlan) await plansApi.createCategory(activePlan.id, data);
          onReload();
        }}
      />
      <QuickAddModal
        open={quickAddOpen}
        accounts={accounts}
        pots={pots}
        plans={plans}
        onClose={onCloseQuickAdd}
        onSubmit={async (data: QuickAddTransactionCreate) => {
          await transactionsApi.quickAddTransaction(data);
          onReload();
        }}
      />
    </>
  );
}
