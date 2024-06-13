import $ from "jsr:@david/dax";
export class AlternativeQuery {
  name: string = "";
  link: string = "";
  status: string = "";
  best: string = "";
  value: string = "";
  alternatives: { path: string; priority: number }[] = [];

  constructor(output: string) {
    const lines = output.trim().split("\n");
    let currentKey: string | null = null;
    let currentAlternative: { path: string; priority: number } | null = null;

    lines.forEach((line) => {
      const [key, value] = line.split(":").map((str) => str.trim());

      if (key === "") {
        // Handle additional newlines
        if (currentKey === "Alternative" && currentAlternative) {
          currentAlternative.priority = parseInt(value, 10);
        }
      } else {
        if (key === "Alternative") {
          currentAlternative = { path: value, priority: 0 };
          this.alternatives.push(currentAlternative);
          currentKey = "Alternative";
          return;
        } else if (key === "Priority") {
          if (currentKey === "Alternative" && currentAlternative) {
            currentAlternative.priority = parseInt(value, 10);
          }
          return;
        }

        switch (key) {
          case "Name":
            this.name = value;
            break;
          case "Link":
            this.link = value;
            break;
          case "Status":
            this.status = value;
            break;
          case "Best":
            this.best = value;
            break;
          case "Value":
            this.value = value;
            break;
        }
      }
    });
  }
  static async fromQuery(name: string) {
    const output = await $`update-alternatives --query ${name}`.text();
    return new AlternativeQuery(output);
  }
}
