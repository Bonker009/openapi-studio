"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { EndpointDetailModal } from "@/components/endpoint-detail-modal";
import { VersionHistorySheet } from "@/components/version-history-sheet";
import { DocumentationSpecHeader } from "@/components/documentation-spec-header";
import { ExportEndpointsDialog } from "@/components/export-endpoints-dialog";
import { EndpointsDataTable } from "@/components/endpoints/endpoints-data-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchData, saveData } from "@/lib/data-service";
import { getControllerBadgeStyle } from "@/lib/controller-colors";
import { toast } from "sonner";

import Link from "next/link";
import { useParams } from "next/navigation";

type EndpointStatus = {
  path: string;
  method: string;
  working: boolean;
  notes: string;
};

type EndpointData = {
  path: string;
  method: string;
  controller: string;
  operationId: string;
  working: boolean;
  notes: string;
};

export default function Documentation() {
  const params = useParams();
  const id = params?.id as string;

  const [apiData, setApiData] = useState<any>(null);

  const [endpointStatuses, setEndpointStatuses] = useState<EndpointStatus[]>(
    []
  );
  const [endpoints, setEndpoints] = useState<EndpointData[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointData | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedControllers, setExpandedControllers] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controllerSearch, setControllerSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const specData = await fetchData("spec", id);
        if (!specData) {
          setError(`API specification '${id}' not found`);
          return;
        }

        setApiData(specData);

        const statusData = await fetchData("status", id);
        if (statusData && Array.isArray(statusData)) {
          setEndpointStatuses(statusData);
        }

        const settingsData = await fetchData("settings", id);
        if (settingsData && settingsData.expandedControllers) {
          setExpandedControllers(settingsData.expandedControllers);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load API documentation");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  useEffect(() => {
    if (!apiData) return;

    try {
      const extractedEndpoints: EndpointData[] = [];

      Object.entries(apiData.paths || {}).forEach(
        ([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(([method, data]: [string, any]) => {
            const controller =
              data.tags && data.tags.length > 0 ? data.tags[0] : "unknown";
            const status = endpointStatuses.find(
              (status) =>
                status.path === path && status.method === method.toLowerCase()
            );

            extractedEndpoints.push({
              path,
              method: method.toUpperCase(),
              controller,
              operationId: data.operationId || "unknown",
              working: status?.working || false,
              notes: status?.notes || "",
            });
          });
        }
      );

      setEndpoints(extractedEndpoints);

      const controllers = [
        ...new Set(extractedEndpoints.map((e) => e.controller)),
      ];
      const newExpandedState: Record<string, boolean> = {
        ...expandedControllers,
      };

      controllers.forEach((controller) => {
        if (newExpandedState[controller] === undefined) {
          newExpandedState[controller] = true;
        }
      });

      setExpandedControllers(newExpandedState);
      saveSettings();
    } catch (error) {
      console.error("Error processing API data:", error);
      toast.error("Error", {
        description: "Failed to process API data",
      });
    }
  }, [apiData, endpointStatuses]);

  const saveSettings = async () => {
    try {
      await saveData("settings", { expandedControllers }, id);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const saveEndpointStatuses = async (statuses: EndpointStatus[]) => {
    try {
      await saveData("status", statuses, id);
    } catch (error) {
      console.error("Error saving endpoint statuses:", error);
      toast.error("Error", {
        description: "Failed to save endpoint statuses",
      });
    }
  };

  const endpointsByController = useMemo(() => {
    const grouped: Record<string, EndpointData[]> = {};

    let filteredEndpoints = endpoints;
    if (activeTab === "working") {
      filteredEndpoints = endpoints.filter((endpoint) => endpoint.working);
    } else if (activeTab === "not-working") {
      filteredEndpoints = endpoints.filter((endpoint) => !endpoint.working);
    }

    filteredEndpoints.forEach((endpoint) => {
      if (!grouped[endpoint.controller]) {
        grouped[endpoint.controller] = [];
      }
      grouped[endpoint.controller].push(endpoint);
    });

    return grouped;
  }, [endpoints, activeTab]);

  const filteredControllers = useMemo(() => {
    const controllers = Object.entries(endpointsByController);
    if (!controllerSearch) return controllers;

    return controllers.filter(([controller]) =>
      controller.toLowerCase().includes(controllerSearch.toLowerCase())
    );
  }, [endpointsByController, controllerSearch]);

  const toggleEndpointStatus = async (path: string, method: string) => {
    try {
      const methodLower = method.toLowerCase();

      const existingStatusIndex = endpointStatuses.findIndex(
        (status) => status.path === path && status.method === methodLower
      );

      let updatedStatuses;

      if (existingStatusIndex >= 0) {
        updatedStatuses = [...endpointStatuses];
        updatedStatuses[existingStatusIndex] = {
          ...updatedStatuses[existingStatusIndex],
          working: !updatedStatuses[existingStatusIndex].working,
        };
      } else {
        updatedStatuses = [
          ...endpointStatuses,
          {
            path,
            method: methodLower,
            working: true,
            notes: "",
          },
        ];
      }

      setEndpointStatuses(updatedStatuses);
      await saveEndpointStatuses(updatedStatuses);

      setEndpoints(
        endpoints.map((endpoint) => {
          if (endpoint.path === path && endpoint.method === method) {
            return {
              ...endpoint,
              working: !endpoint.working,
            };
          }
          return endpoint;
        })
      );

      if (
        selectedEndpoint &&
        selectedEndpoint.path === path &&
        selectedEndpoint.method === method
      ) {
        setSelectedEndpoint({
          ...selectedEndpoint,
          working: !selectedEndpoint.working,
        });
      }
    } catch (error) {
      console.error("Error toggling endpoint status:", error);
      toast.error("Error", {
        description: "Failed to update endpoint status",
      });
    }
  };

  const updateEndpointNotes = async (
    path: string,
    method: string,
    notes: string
  ) => {
    try {
      const methodLower = method.toLowerCase();

      const existingStatusIndex = endpointStatuses.findIndex(
        (status) => status.path === path && status.method === methodLower
      );

      let updatedStatuses;

      if (existingStatusIndex >= 0) {
        updatedStatuses = [...endpointStatuses];
        updatedStatuses[existingStatusIndex] = {
          ...updatedStatuses[existingStatusIndex],
          notes,
        };
      } else {
        updatedStatuses = [
          ...endpointStatuses,
          {
            path,
            method: methodLower,
            working: false,
            notes,
          },
        ];
      }

      setEndpointStatuses(updatedStatuses);
      await saveEndpointStatuses(updatedStatuses);

      setEndpoints(
        endpoints.map((endpoint) => {
          if (endpoint.path === path && endpoint.method === method) {
            return {
              ...endpoint,
              notes,
            };
          }
          return endpoint;
        })
      );

      if (
        selectedEndpoint &&
        selectedEndpoint.path === path &&
        selectedEndpoint.method === method
      ) {
        setSelectedEndpoint({
          ...selectedEndpoint,
          notes,
        });
      }
    } catch (error) {
      console.error("Error updating endpoint notes:", error);
      toast.error("Error", {
        description: "Failed to update endpoint notes",
      });
    }
  };

  // Filter endpoints based on active tab
  const filteredEndpoints = () => {
    if (activeTab === "all") return endpoints;
    if (activeTab === "working")
      return endpoints.filter((endpoint) => endpoint.working);
    if (activeTab === "not-working")
      return endpoints.filter((endpoint) => !endpoint.working);
    return endpoints;
  };

  const openEndpointModal = (endpoint: EndpointData) => {
    setSelectedEndpoint(endpoint);
    setIsModalOpen(true);
  };

  const closeEndpointModal = () => {
    setIsModalOpen(false);
  };

  const getEndpointStatus = (path: string, method: string) => {
    const status = endpointStatuses.find(
      (status) => status.path === path && status.method === method.toLowerCase()
    );
    return {
      working: status?.working || false,
      notes: status?.notes || "",
    };
  };

  const toggleControllerExpanded = async (controller: string) => {
    const newExpandedState = {
      ...expandedControllers,
      [controller]: !expandedControllers[controller],
    };
    setExpandedControllers(newExpandedState);

    try {
      await saveData("settings", { expandedControllers: newExpandedState }, id);
    } catch (error) {
      console.error("Error saving controller expanded state:", error);
    }
  };

  const totalEndpoints = endpoints.length;
  const workingEndpoints = endpoints.filter((e) => e.working).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          title="Loading…"
          eyebrow="API documentation"
          showBackButton={true}
        />
        <main className="container mx-auto py-8 px-4 max-w-screen-2xl">
          <div className="mb-8 rounded-xl border bg-card p-8 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <div className="grid grid-cols-2 gap-3 pt-4 max-w-md">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>

          <Skeleton className="h-10 w-full mb-6" />

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Error" eyebrow="API documentation" showBackButton={true} />
        <main className="container mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">
                Error Loading Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{error}</p>
              <Button onClick={() => (window.location.href = "/")}>
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VersionHistorySheet
        specId={id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestored={() => {
          fetchData("spec", id).then(setApiData);
        }}
      />
      <Header
        title="API documentation"
        description={apiData?.info?.title}
        eyebrow="Poseidon"
        showBackButton={true}
        specId={id}
        onHistoryClick={() => setHistoryOpen(true)}
      />
      <main className="container mx-auto py-8 px-4 max-w-screen-2xl">
        <DocumentationSpecHeader
          specId={id}
          title={apiData?.info?.title || "API Documentation"}
          version={apiData?.info?.version}
          description={apiData?.info?.description}
          servers={apiData?.servers}
          authScheme={
            apiData?.components?.securitySchemes?.bearerAuth?.scheme as
              | string
              | undefined
          }
          totalEndpoints={totalEndpoints}
          workingEndpoints={workingEndpoints}
          onDownloadCsv={() => setExportOpen(true)}
        />

        <ExportEndpointsDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          endpoints={endpoints}
          defaultFileName={apiData?.info?.title || "api-endpoints"}
        />

        <Tabs
          defaultValue="all"
          className="mb-6 w-full"
          onValueChange={setActiveTab}
        >
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All Endpoints
            </TabsTrigger>
            <TabsTrigger value="working" className="flex-1">
              Working
            </TabsTrigger>
            <TabsTrigger value="not-working" className="flex-1">
              Not Working
            </TabsTrigger>
            <TabsTrigger value="by-controller" className="flex-1">
              By Controller
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6 w-full">
            <EndpointsDataTable
              data={filteredEndpoints()}
              getControllerBadgeStyle={getControllerBadgeStyle}
              onToggleStatus={toggleEndpointStatus}
              onOpenModal={openEndpointModal}
            />
          </TabsContent>

          <TabsContent value="working" className="mt-6">
            <EndpointsDataTable
              data={filteredEndpoints()}
              getControllerBadgeStyle={getControllerBadgeStyle}
              onToggleStatus={toggleEndpointStatus}
              onOpenModal={openEndpointModal}
            />
          </TabsContent>

          <TabsContent value="not-working" className="mt-6">
            <EndpointsDataTable
              data={filteredEndpoints()}
              getControllerBadgeStyle={getControllerBadgeStyle}
              onToggleStatus={toggleEndpointStatus}
              onOpenModal={openEndpointModal}
            />
          </TabsContent>

          <TabsContent value="by-controller" className="mt-6">
            <div className="space-y-6">
              {/* Add search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search controllers…"
                  value={controllerSearch}
                  onChange={(e) => setControllerSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {controllerSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setControllerSearch("")}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear</span>
                  </Button>
                )}
              </div>

              {filteredControllers.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground">
                      {controllerSearch
                        ? `No controllers matching "${controllerSearch}"`
                        : "No endpoints found"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredControllers.map(([controller, controllerEndpoints]) => (
                  <Collapsible
                    key={controller}
                    open={expandedControllers[controller]}
                    onOpenChange={() => toggleControllerExpanded(controller)}
                    className="border rounded-md overflow-hidden shadow-sm"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center">
                        {expandedControllers[controller] ? (
                          <ChevronDown className="h-5 w-5 mr-2" />
                        ) : (
                          <ChevronRight className="h-5 w-5 mr-2" />
                        )}
                        <Badge
                          variant="outline"
                          className="px-3 py-1"
                          style={getControllerBadgeStyle(controller)}
                        >
                          {controller}
                        </Badge>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {controllerEndpoints.length} endpoints
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {controllerEndpoints.filter((e) => e.working).length}{" "}
                          working
                        </Badge>
                        <Badge variant="outline">
                          {controllerEndpoints.filter((e) => !e.working).length}{" "}
                          not working
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <EndpointsDataTable
                        data={controllerEndpoints}
                        getControllerBadgeStyle={getControllerBadgeStyle}
                        onToggleStatus={toggleEndpointStatus}
                        onOpenModal={openEndpointModal}
                        hideController
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {selectedEndpoint && (
          <EndpointDetailModal
            isOpen={isModalOpen}
            onClose={closeEndpointModal}
            endpoint={selectedEndpoint}
            path={selectedEndpoint.path}
            method={selectedEndpoint.method}
            apiData={apiData}
            status={getEndpointStatus(
              selectedEndpoint.path,
              selectedEndpoint.method
            )}
            onToggleStatus={toggleEndpointStatus}
            onUpdateNotes={updateEndpointNotes}
            getControllerBadgeStyle={getControllerBadgeStyle}
          />
        )}
      </main>
    </div>
  );
}
