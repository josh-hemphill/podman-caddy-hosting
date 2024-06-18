declare type TemplateKubeYaml = {
  apiVersion: string;
  kind: string;
  metadata: {
    creationTimestamp: string;
    labels: {
      app: string;
    };
    name: string;
    annotations: Record<string, string>;
  };
  spec: {
    containers: {
      args?: string[];
      env?: {
        name: string;
        value: string;
      }[];
      image: string;
      name: string;
      ports?: {
        containerPort: number;
        hostPort?: number;
      }[];
      volumeMounts?: {
        mountPath: string;
        name: string;
        readOnly?: boolean;
      }[];
    }[];
    hostname: string;
    hostAliases?: {
      ip?: string;
      hostnames: string[];
    }[];
    volumes: {
      hostPath?: {
        path: string;
        type: string;
      };
      name: string;
    }[];
  };
};
