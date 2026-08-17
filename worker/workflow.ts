import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

type ExplodelySale = {
  orderid: string;
  amount: number;
  seller: string;
  tid: string;
  affcup: string;
  country: string;
  saletimestamp: string;
  receivedAt: number;
};

export class MyWorkflow extends WorkflowEntrypoint<Env, ExplodelySale> {
  async run(event: WorkflowEvent<ExplodelySale>, step: WorkflowStep) {
    const instanceId = event.instanceId;
    const statusStub = this.env.WORKFLOW_STATUS.get(
      this.env.WORKFLOW_STATUS.idFromName(instanceId),
    ) as any;

    const notify = async (name: string, status: "running" | "completed") => {
      try {
        await statusStub.updateStep(name, status);
      } catch {
        // Metrics recording must not fail because a live-status update failed.
      }
    };

    await notify("validate sale", "running");
    const sale = await step.do("validate sale", async () => {
      const p = event.payload;
      if (!p.orderid || !Number.isFinite(p.amount) || p.amount < 0) {
        throw new Error("Invalid Explodely sale event");
      }
      return {
        orderid: p.orderid,
        amount: Number(p.amount),
        seller: p.seller || "",
        tid: p.tid || "",
        country: p.country || "",
        saletimestamp: p.saletimestamp || "",
        receivedAt: p.receivedAt || Date.now(),
      };
    });
    await notify("validate sale", "completed");

    await notify("record commission", "running");
    const result = await step.do("record commission", async () => {
      const dashboard = this.env.WORKFLOW_STATUS.get(
        this.env.WORKFLOW_STATUS.idFromName("moneyhi11s-dashboard"),
      ) as any;
      return await dashboard.recordSale(sale);
    });
    await notify("record commission", "completed");

    await notify("finish", "running");
    const output = await step.do("finish", async () => ({
      orderid: sale.orderid,
      recorded: !result.duplicate,
      duplicate: Boolean(result.duplicate),
      amount: sale.amount,
      source: result.source,
      offer: result.offer,
    }));
    await notify("finish", "completed");
    return output;
  }
}
