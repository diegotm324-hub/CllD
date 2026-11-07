"use client";

// ==============================================================================
// ContablePro - Modal Amigable de Configuración SUNAT (Clave SOL)
// Diseñado para contadores y usuarios de negocio (Cero configuración técnica)
// ==============================================================================

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  KeyRound,
  Building2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { testAndSaveSunatConnectionAction, getSunatStatusAction } from "@/app/actions/sire";

export interface SunatConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRuc?: string;
  onSuccess?: () => void;
}

export function SunatConfigModal({
  isOpen,
  onClose,
  currentRuc = "10746979636",
  onSuccess,
}: SunatConfigModalProps) {
  const [ruc, setRuc] = useState(currentRuc);
  const [usuarioSol, setUsuarioSol] = useState("");
  const [claveSol, setClaveSol] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRuc(currentRuc);
      setStatusMessage(null);

      // Pre-cargar usuario si existe
      getSunatStatusAction().then((status) => {
        if (status.isConfigured && status.username) {
          setUsuarioSol(status.username);
        }
      });
    }
  }, [isOpen, currentRuc]);

  if (!isOpen) return null;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setStatusMessage(null);

    try {
      const res = await testAndSaveSunatConnectionAction({
        ruc,
        usuarioSol,
        claveSol,
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: res.message || "¡Conexión exitosa con SUNAT! Credenciales verificadas.",
        });
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMessage({
          type: "error",
          text: res.message || "Usuario SOL o Clave incorrecta. Verifique sus datos en el portal SUNAT.",
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: "Error de red al comunicarse con el servidor. Intente nuevamente.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                Conectar con SUNAT (Clave SOL)
              </h3>
              <p className="text-[11px] text-slate-400">
                Sincronización automática de propuestas SIRE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleVerifyAndSave} className="p-6 space-y-4">
          {/* Mensaje de Estado */}
          {statusMessage && (
            <div
              className={cn(
                "p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200",
                statusMessage.type === "success"
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                  : "bg-red-950/60 border-red-500/40 text-red-200"
              )}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Campo 1: RUC de la Empresa */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              1. RUC de la Empresa
            </label>
            <input
              type="text"
              value={ruc}
              onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
              required
              maxLength={11}
              placeholder="10746979636"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              RUC de 11 dígitos de la empresa activa en el sistema.
            </p>
          </div>

          {/* Campo 2: Usuario SOL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              2. Usuario SOL
            </label>
            <input
              type="text"
              value={usuarioSol}
              onChange={(e) => setUsuarioSol(e.target.value.toUpperCase())}
              required
              placeholder="EJ: SCABCASH O MODDATOS"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Usuario principal o secundario de Clave SOL.
            </p>
          </div>

          {/* Campo 3: Clave SOL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              3. Contraseña / Clave SOL
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={claveSol}
                onChange={(e) => setClaveSol(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-10 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Se transmite mediante canal TLS cifrado exclusivamente a SUNAT.
            </p>
          </div>

          {/* Nota de Seguridad */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Configuración simplificada: No necesitas crear Client IDs ni APIs. Tus credenciales se verifican directamente con los servidores oficiales de SUNAT.
            </span>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isVerifying || !ruc || !usuarioSol || !claveSol}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg shadow-lg transition-all cursor-pointer",
                isVerifying || !ruc || !usuarioSol || !claveSol
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/30"
              )}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verificando con SUNAT...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verificar y Conectar con SUNAT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
