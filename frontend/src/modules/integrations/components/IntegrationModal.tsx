import { type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { IntegrationWithState, type IntegrationProfile } from "@/modules/integrations/types/integration";
import { useScrollLock } from "@/hooks/useScrollLock";




type ModalProps = {


  open: boolean;


  integration: IntegrationWithState | null;


  readOnly?: boolean;


  readOnlyReason?: string;


  onClose: () => void;


  onSave: (id: string, data: Record<string, string>) => Promise<ActionResult> | ActionResult;


  onDisconnect: (id: string) => Promise<ActionResult> | ActionResult;


};





type ActionResult = {


  success: boolean;


  message?: string;


};





export function IntegrationModal({


  open,


  integration,


  readOnly = false,


  readOnlyReason,


  onClose,


  onSave,


  onDisconnect,


}: ModalProps) {

  useScrollLock(open);

  const initialFormData = useMemo(() => {


    if (!integration) return {};


    const next: Record<string, string> = {};


    integration.fields.forEach((field) => {


      next[field.id] = integration.config?.[field.id] ?? "";


    });


    return next;


  }, [integration]);





  const [formData, setFormData] = useState<Record<string, string>>(initialFormData);


  const [profiles, setProfiles] = useState<IntegrationProfile[]>(integration?.profiles ?? []);


  const [selectedProfile, setSelectedProfile] = useState<string>(


    integration?.activeProfile || integration?.config?.profileName || integration?.profiles?.[0]?.name || ""


  );


  const [makeActive, setMakeActive] = useState(true);


  const [submitting, setSubmitting] = useState(false);


  const [feedback, setFeedback] = useState<string | null>(null);


  const initialFieldRef = useRef<HTMLInputElement | null>(null);





  const isConnected = integration?.status === "CONECTADO";


  const lockMessage = readOnlyReason ?? "Somente administradores podem conectar ou desconectar integrações.";





  const headline = useMemo(() => {


    if (!integration) return "";


    return `${isConnected ? "Gerenciar" : "Conectar"} ${integration.name}`;


  }, [integration, isConnected]);


  useEffect(() => {


    if (!open) return;


    const onKeyDown = (event: KeyboardEvent) => {


      if (event.key === "Escape") {


        onClose();


      }


    };





    window.addEventListener("keydown", onKeyDown);


    return () => window.removeEventListener("keydown", onKeyDown);


  }, [open, onClose]);




  useEffect(() => {
    if (!integration) return;
    const nextProfiles = integration.profiles ?? [];
    setProfiles(nextProfiles);
    const initialSelected =
      integration.activeProfile || integration.config?.profileName || nextProfiles[0]?.name || "";
    setSelectedProfile(initialSelected);
    setFormData(initialFormData);
    setMakeActive(true);
  }, [integration, initialFormData]);



  useEffect(() => {
    const found = profiles.find((p) => p.name === selectedProfile);


    if (found) {


      setFormData(found.data);


    } else if (!selectedProfile && Object.keys(initialFormData).length) {


      setFormData(initialFormData);


    }


  }, [profiles, selectedProfile, initialFormData]);





  useEffect(() => {


    if (open && initialFieldRef.current) {


      initialFieldRef.current.focus();


    }


  }, [open, integration]);





  if (!open || !integration) {


    return null;


  }





  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {


    if (event.target === event.currentTarget) {


      onClose();


    }


  };





  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {


    event.preventDefault();


    setSubmitting(true);


    setFeedback(null);





    if (readOnly) {


      setSubmitting(false);


      setFeedback(lockMessage);


      return;


    }





    const result = await Promise.resolve(


      integration.id === "ixc"


        ? (() => {


            const profileName =


              formData.profileName?.trim() ||


              selectedProfile.trim() ||


              integration?.activeProfile ||


              "IXC";


            const nextProfiles: IntegrationProfile[] = [


              { name: profileName, data: { ...formData, profileName } },


              ...profiles.filter((p) => p.name !== profileName),


            ];


            const activeProfileName = makeActive


              ? profileName


              : integration?.activeProfile || selectedProfile || profileName;


            return onSave(integration.id, {


              ...formData,


              profileName,


              __profiles: JSON.stringify(nextProfiles),


              __activeProfile: activeProfileName,


            });


          })()


        : onSave(integration.id, formData)


    );


        setSubmitting(false);





    if (!result.success) {


      setFeedback(result.message ?? "Não foi possível salvar.");


      return;


    }





    onClose();


  };





  const handleDisconnect = async () => {


    if (!integration) return;


    setSubmitting(true);


    setFeedback(null);





    if (readOnly) {


      setSubmitting(false);


      setFeedback(lockMessage);


      return;


    }





    const result = await Promise.resolve(onDisconnect(integration.id));


    setSubmitting(false);





    if (!result.success) {


      setFeedback(result.message ?? "Não foi possível desconectar.");


      return;


    }





    onClose();


  };





  return (


    <div


      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"


      onClick={handleOverlayClick}


      role="dialog"


      aria-modal="true"


    >


      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">


        <div className="relative flex flex-col items-center gap-2 text-center">


          <button


            className="absolute right-0 top-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"


            onClick={onClose}


            aria-label="Fechar"


            type="button"


          >


            X


          </button>


          <div className="flex flex-col items-center gap-1">


            <p className="text-sm uppercase tracking-[0.25em] text-indigo-300">


              {isConnected ? "Gerenciar" : "Conectar"}


            </p>


            <h2 className="text-2xl font-semibold text-white">{headline}</h2>


            {isConnected && integration.config?.profileName && (


              <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-100">


                Conectado em {integration.config.profileName}


              </div>


            )}


          </div>


          {integration.id === "ixc" ? (


            <p className="text-sm text-slate-400">


              Informe Cliente, URL do IXC, usuario/senha e IDs basicos. O perfil fica salvo e sincronizado com o Lanador de comodato.


            </p>


          ) : (


            <p className="text-sm text-slate-400">{integration.description}</p>


          )}


        </div>





        {readOnly && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            {lockMessage}
          </div>
        )}

        {integration.id === "ixc" && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-indigo-300">Perfis IXC</span>
              {selectedProfile && (
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={makeActive}
                    onChange={(e) => setMakeActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  Definir como ativo
                </label>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-center">
              <select
                value={selectedProfile}
                onChange={(e) => {
                  setSelectedProfile(e.target.value);
                  setMakeActive(false);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-indigo-400 focus:ring-indigo-500/30"
              >
                {profiles.length === 0 && <option value="">Nenhum perfil salvo</option>}
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
                {!profiles.some((p) => p.name === selectedProfile) && selectedProfile && (
                  <option value={selectedProfile}>{selectedProfile}</option>
                )}
              </select>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfile("");
                    setFormData(initialFormData);
                    setMakeActive(true);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-white transition hover:border-indigo-400/50 hover:bg-slate-800"
                >
                  Novo perfil
                </button>
                {selectedProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfiles((prev) => prev.filter((p) => p.name !== selectedProfile));
                      setSelectedProfile("");
                    }}
                    className="rounded-lg border border-red-400/50 bg-red-600/80 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        )}



        <form className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>


          {integration.fields.map((field, index) => (


            <div className="space-y-2" key={field.id}>


              <label className="text-sm text-slate-200" htmlFor={field.id}>


                {field.label}


              </label>


              <input


                id={field.id}


                name={field.id}


                ref={index === 0 ? initialFieldRef : undefined}


                type={field.type ?? "text"}


                value={formData[field.id] ?? ""}


                placeholder={field.placeholder}


                onChange={(event) =>


                  setFormData((prev) => ({


                    ...prev,


                    [field.id]: event.target.value,


                  }))


                }


                disabled={readOnly || submitting}


                className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none ring-2 ring-transparent transition focus:border-indigo-400 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40"


              />


              {field.helperText && <p className="text-xs text-slate-500">{field.helperText}</p>}


            </div>


          ))}





          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">


            {isConnected && (


              <button


                type="button"


                onClick={handleDisconnect}


                disabled={submitting}


                className="rounded-lg border border-red-400/40 bg-red-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-800"


              >


                Desconectar


              </button>


            )}


            <button


              type="submit"


              disabled={submitting}


              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60"


            >


              {isConnected ? "Salvar alterações" : "Conectar"}


            </button>


            {feedback && <span className="text-sm text-red-200">{feedback}</span>}


          </div>


        </form>


      </div>


    </div>


  );


}
