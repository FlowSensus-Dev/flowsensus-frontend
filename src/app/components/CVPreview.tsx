/**
 * CVPreview.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Professional black-and-white A4 CV layout with 2-Page pagination.
 *
 * Requirements:
 *   - 0.5 inch (48px) margins on ALL pages (Page 1 and Page 2).
 *   - 2×2 inch (192×192px) applicant photo frame on Page 1.
 *   - Photo resolved from photoDataUrl, photo, photoUrl, or photo_url.
 *   - Pre-conversion to Base64 in PDF export so images never appear blank or get blocked by CORS.
 *   - Custom fields (including links like YouTube) cleanly rendered with word-break.
 *   - Preview clearly displays distinct Page 1 and Page 2 sheets without combined cut-off.
 *   - Downloaded PDF matches preview 1-to-1 without mid-section text slicing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
// @ts-ignore
import { createRoot } from 'react-dom/client';
import { ApplicantRecord } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const A4_W = 794;           // A4 width at 96 dpi (210mm)
export const A4_H = 1123;          // A4 height at 96 dpi (297mm)
export const PAGE_PAD = 48;        // 0.5 inch padding (12.7mm)
export const PHOTO_SIZE = 192;     // 2 × 2 inches at 96 dpi
export const INDENT = 20;          // left-indent for section content

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CVPreviewProps {
  applicant: ApplicantRecord;
  summaryOverride?: string;
  customFields?: { key: string; value: string }[];
  cvId?: number;
  preparedBy?: string;
  scale?: number;
}

// ─── Photo Resolution Helper ──────────────────────────────────────────────────

export function getApplicantPhoto(a?: ApplicantRecord | null): string {
  if (!a) return '';
  return a.photoDataUrl || a.photo || a.photoUrl || (a as any)?.photo_url || '';
}

/**
 * Converts an image (SVG, remote URL, Supabase storage, or data URL) into a crisp PNG Data URL.
 * Guarantees that html2canvas receives a same-origin raster bitmap and never fails or renders blank.
 */
export async function convertPhotoToRasterDataUrl(url: string, targetSize = 384): Promise<string> {
  if (!url) return '';
  // If it's already a raster data URL, return as is
  if (url.startsWith('data:image/png') || url.startsWith('data:image/jpeg') || url.startsWith('data:image/webp')) {
    return url;
  }

  const rasterizeSvgText = async (svgText: string): Promise<string> => {
    let cleanSvg = svgText;
    // Force explicit width and height on root <svg> tag so canvas measures non-zero intrinsic size
    cleanSvg = cleanSvg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
      const cleanedAttrs = attrs.replace(/\b(width|height)=["'][^"']*["']/gi, '');
      return `<svg${cleanedAttrs} width="${targetSize}" height="${targetSize}">`;
    });

    const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetSize, targetSize);
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
            URL.revokeObjectURL(blobUrl);
            resolve(canvas.toDataURL('image/png', 1.0));
            return;
          }
        } catch (err) {
          console.warn('Canvas drawImage for SVG failed:', err);
        }
        URL.revokeObjectURL(blobUrl);
        resolve(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(url);
      };
      img.src = blobUrl;
    });
  };

  // If it's already an SVG data URL:
  if (url.startsWith('data:image/svg+xml')) {
    try {
      const isBase64 = url.includes(';base64,');
      let svgText = '';
      if (isBase64) {
        svgText = atob(url.split(';base64,')[1]);
      } else {
        svgText = decodeURIComponent(url.split(',')[1]);
      }
      return await rasterizeSvgText(svgText);
    } catch (e) {
      console.warn('Failed to parse SVG data URL:', e);
    }
  }

  // Helper to fetch response directly or via backend photo-proxy
  const fetchImageResponse = async (imgUrl: string): Promise<Response> => {
    try {
      const res = await fetch(imgUrl, { mode: 'cors' });
      if (res.ok) return res;
    } catch {}
    // Fallback to backend proxy
    const proxyUrl = `http://localhost:8000/photo-proxy?url=${encodeURIComponent(imgUrl)}`;
    return await fetch(proxyUrl);
  };

  try {
    const res = await fetchImageResponse(url);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const isSvg = contentType.includes('svg') || url.includes('.svg');

      if (isSvg) {
        const svgText = await res.text();
        const raster = await rasterizeSvgText(svgText);
        if (raster && raster.startsWith('data:image/png')) {
          return raster;
        }
      } else {
        const blob = await res.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || url);
          reader.onerror = () => resolve(url);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (err) {
    console.warn('Failed fetching image for rasterization:', err);
  }

  // Final fallback: Image() element with canvas draw
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetSize, targetSize);
          ctx.drawImage(img, 0, 0, targetSize, targetSize);
          resolve(canvas.toDataURL('image/png', 1.0));
          return;
        }
      } catch {}
      resolve(url);
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

/** Legacy alias */
export const getBase64Image = convertPhotoToRasterDataUrl;

// ─── Section heading with rule ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {/* Title + rule */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: '#000',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.3,
            paddingBottom: 6,
            borderBottom: '1.5px solid #000',
          }}
        >
          {title}
        </div>
      </div>
      {/* Indented content */}
      <div style={{ paddingLeft: INDENT, fontSize: 10, color: '#111', lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div style={{ display: 'flex', marginBottom: 2, alignItems: 'flex-start' }}>
      <span style={{ fontWeight: 700, minWidth: 190, flexShrink: 0, color: '#000' }}>
        {label}
      </span>
      <span style={{ color: '#111', wordBreak: 'break-all', flex: 1 }}>
        :&nbsp;&nbsp;{value}
      </span>
    </div>
  );
}

// ─── Page 1 Component ─────────────────────────────────────────────────────────

export function CVPage1Content({
  applicant: a,
  summary,
  photoUrl,
  pageCount = 2,
}: {
  applicant: ApplicantRecord;
  summary: string;
  photoUrl?: string;
  pageCount?: number;
}) {
  const photoSrc = photoUrl || getApplicantPhoto(a);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: A4_H - (PAGE_PAD * 2),
      }}
    >
      <div>
        {/* ══ HEADER: Photo + info directly beside it ══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 14 }}>
          {/* Photo — 2×2 in */}
          <div style={{ flexShrink: 0 }}>
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={a.name || 'Applicant'}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (photoSrc.startsWith('http') && !photoSrc.includes('/photo-proxy')) {
                    target.src = `http://localhost:8000/photo-proxy?url=${encodeURIComponent(photoSrc)}`;
                  }
                }}
                style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  objectFit: 'cover',
                  border: '1px solid #000',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  border: '1px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#666',
                  textAlign: 'center',
                  lineHeight: 1.4,
                  background: '#f9f9f9',
                }}
              >
                2&times;2<br />Photo
              </div>
            )}
          </div>

          {/* Info block — directly beside photo */}
          <div style={{ flex: 1, fontSize: 10, color: '#111', lineHeight: 1.75 }}>
            {a.name && (
              <div style={{ fontWeight: 700, fontSize: 14, color: '#000', marginBottom: 2 }}>
                {a.name}
              </div>
            )}
            {(a.role || a.appliedRole) && (
              <div style={{ fontStyle: 'italic', marginBottom: 4, color: '#333' }}>
                {a.role || a.appliedRole}
              </div>
            )}
            {a.presentAddress && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>Address: </span>
                {a.presentAddress}
              </div>
            )}
            {a.email && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>Email: </span>
                {a.email}
              </div>
            )}
            {a.contact && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>Mobile: </span>
                {a.contact}
              </div>
            )}
            {a.facebookUrl && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>Facebook: </span>
                <span style={{ wordBreak: 'break-all' }}>{a.facebookUrl}</span>
              </div>
            )}
            {a.whatsappNumber && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>WhatsApp: </span>
                {a.whatsappNumber}
              </div>
            )}
            {a.linkedinUrl && (
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>LinkedIn: </span>
                <span style={{ wordBreak: 'break-all' }}>{a.linkedinUrl}</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ TITLE BAR: Curriculum Vitae ══ */}
        <div
          style={{
            borderTop: '2px solid #000',
            borderBottom: '2px solid #000',
            paddingTop: 8,
            paddingBottom: 8,
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 13,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              lineHeight: 1.3,
              margin: 0,
              padding: '2px 0',
              color: '#000',
            }}
          >
            Curriculum Vitae
          </h1>
        </div>

        {/* ══ PERSONAL INFORMATION ══ */}
        <Section title="Personal Information">
          <Field label="Full Name" value={a.name} />
          <Field label="Date of Birth" value={a.dateOfBirth} />
          <Field label="Place of Birth" value={a.placeOfBirth} />
          <Field label="Age" value={a.age ? `${a.age} years old` : undefined} />
          <Field label="Sex" value={a.sex} />
          <Field label="Civil Status" value={a.civilStatus} />
          <Field
            label="No. of Children"
            value={a.noOfChildren !== undefined && a.noOfChildren !== null ? String(a.noOfChildren) : undefined}
          />
          <Field label="Religion" value={a.religion} />
          <Field label="Citizenship" value={a.citizenship || 'Filipino'} />
          <Field label="Height" value={a.heightCm ? `${a.heightCm} cm` : undefined} />
          <Field label="Weight" value={a.weightKg ? `${a.weightKg} kg` : undefined} />
          <Field label="Present Address" value={a.presentAddress} />
          <Field label="Provincial Address" value={a.provincialAddress} />
          <Field label="Email Address" value={a.email} />
          <Field label="Mobile No." value={a.contact} />
          {a.facebookUrl && <Field label="Facebook" value={a.facebookUrl} />}
          {a.whatsappNumber && <Field label="WhatsApp" value={a.whatsappNumber} />}
          {a.linkedinUrl && <Field label="LinkedIn" value={a.linkedinUrl} />}
          {(a.languagesSpoken || []).length > 0 && (
            <Field label="Languages Spoken" value={(a.languagesSpoken || []).join(', ')} />
          )}
          <Field label="Applied Position" value={a.role || a.appliedRole} />
          <Field label="Applicant Code" value={a.applicantCode} />

          {/* Emergency contact */}
          {a.emergencyContactName && (
            <>
              <div style={{ marginTop: 6, fontWeight: 700, color: '#000', fontSize: 10 }}>
                Emergency Contact
              </div>
              <Field label="Name" value={a.emergencyContactName} />
              <Field label="Relationship" value={a.emergencyContactRelationship} />
              <Field label="Contact No." value={a.emergencyContactNumber} />
            </>
          )}
        </Section>

        {/* ══ OBJECTIVE ══ */}
        <Section title="Objective">
          <p style={{ fontStyle: 'italic', color: '#222', lineHeight: 1.6, margin: 0 }}>
            {summary}
          </p>
        </Section>

        {/* ══ EDUCATION ══ */}
        {(a.education || []).length > 0 && (
          <Section title="Education">
            {(a.education || []).map((ed, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, color: '#000' }}>{ed.school}</div>
                <div style={{ color: '#222' }}>
                  {ed.level}{ed.course ? ` — ${ed.course}` : ''}
                </div>
                {ed.yearGraduated && (
                  <div style={{ fontSize: 9.5, color: '#444' }}>Year Graduated: {ed.yearGraduated}</div>
                )}
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* ══ PAGE 1 FOOTER ══ */}
      <div
        style={{
          borderTop: '1px solid #ccc',
          paddingTop: 4,
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          color: '#555',
        }}
      >
        <span>Curriculum Vitae — {a.name}</span>
        <span>Page 1 of {pageCount}</span>
      </div>
    </div>
  );
}

// ─── Page 2 Component ─────────────────────────────────────────────────────────

export function CVPage2Content({
  applicant: a,
  customFields = [],
}: {
  applicant: ApplicantRecord;
  customFields?: { key: string; value: string }[];
}) {
  const effectiveCustom = (customFields || []).filter((f) => f.key && f.key.trim());

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: A4_H - (PAGE_PAD * 2),
      }}
    >
      <div>
        {/* ══ PAGE 2 HEADER RULE ══ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5px solid #000',
            paddingBottom: 7,
            marginBottom: 14,
            lineHeight: 1.3,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Curriculum Vitae — {a.name}
          </span>
          <span style={{ fontSize: 9.5, color: '#444' }}>
            {a.applicantCode || a.role || a.appliedRole || ''}
          </span>
        </div>

        {/* ══ WORK EXPERIENCE ══ */}
        {(a.employmentHistory || []).length > 0 && (
          <Section title="Work Experience">
            {(a.employmentHistory || []).map((e, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: '#000' }}>{e.company}</div>
                <div style={{ color: '#222' }}>{e.position}</div>
                <div style={{ fontSize: 9.5, color: '#444' }}>
                  {e.dateStarted} – {e.isPresent ? 'Present' : e.dateEnded}
                  {e.country ? `, ${e.country}` : ''}
                </div>
                {e.reasonForLeaving && (
                  <div style={{ fontSize: 9.5, color: '#555' }}>
                    Reason for leaving: {e.reasonForLeaving}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* ══ SKILLS ══ */}
        {(a.skills || []).length > 0 && (
          <Section title="Skills">
            <ol style={{ paddingLeft: 16, margin: 0 }}>
              {(a.skills || []).map((s, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{s}</li>
              ))}
            </ol>
          </Section>
        )}

        {/* ══ LANGUAGE PROFICIENCY ══ */}
        {(a.languageRecords || []).length > 0 && (
          <Section title="Language Proficiency">
            <ol style={{ paddingLeft: 16, margin: 0 }}>
              {(a.languageRecords || []).map((l, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {l.language} — Spoken: {l.spokenRating}/5, Written: {l.writtenRating}/5
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ══ CERTIFICATIONS ══ */}
        {(a.certifications || []).length > 0 && (
          <Section title="Certifications">
            <ol style={{ paddingLeft: 16, margin: 0 }}>
              {(a.certifications || []).map((c, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{c}</li>
              ))}
            </ol>
          </Section>
        )}

        {/* ══ ADDITIONAL INFORMATION (Custom Fields) ══ */}
        {effectiveCustom.length > 0 && (
          <Section title="Additional Information">
            {effectiveCustom.map((f, i) => (
              <Field key={i} label={f.key} value={f.value} />
            ))}
          </Section>
        )}

        {/* ══ SIGNATURE ══ */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', minWidth: 230 }}>
            <div
              style={{
                borderTop: '1px solid #000',
                paddingTop: 4,
                fontSize: 9.5,
                color: '#000',
              }}
            >
              Applicant's Signature over Printed Name
            </div>
          </div>
        </div>
      </div>

      {/* ══ PAGE 2 FOOTER ══ */}
      <div
        style={{
          borderTop: '1px solid #ccc',
          paddingTop: 4,
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          color: '#555',
        }}
      >
        <span>Curriculum Vitae — {a.name}</span>
        <span>Page 2 of 2</span>
      </div>
    </div>
  );
}

// ─── Master Document Component ────────────────────────────────────────────────

export function CVPreviewDoc({
  applicant: a,
  summaryOverride,
  customFields = [],
}: CVPreviewProps) {
  const [rasterPhoto, setRasterPhoto] = React.useState<string>('');

  React.useEffect(() => {
    const raw = getApplicantPhoto(a);
    if (!raw) {
      setRasterPhoto('');
      return;
    }
    let isMounted = true;
    convertPhotoToRasterDataUrl(raw).then((res) => {
      if (isMounted && res) setRasterPhoto(res);
    });
    return () => {
      isMounted = false;
    };
  }, [a]);

  const summary =
    summaryOverride?.trim() ||
    `Experienced ${a.role || a.appliedRole || 'professional'} seeking overseas employment opportunities.`;

  const effectiveCustom = (customFields || []).filter((f) => f.key && f.key.trim());

  // Determine if content warrants 2 pages
  const hasPage2 =
    (a.employmentHistory || []).length > 0 ||
    (a.skills || []).length > 0 ||
    (a.languageRecords || []).length > 0 ||
    (a.certifications || []).length > 0 ||
    effectiveCustom.length > 0;

  const pageCount = hasPage2 ? 2 : 1;

  const pageStyle: React.CSSProperties = {
    width: A4_W,
    minHeight: A4_H,
    background: '#fff',
    fontFamily: "Arial, 'Helvetica Neue', sans-serif",
    color: '#000',
    padding: PAGE_PAD,
    boxSizing: 'border-box',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    borderRadius: 2,
    position: 'relative',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' }}>
      {/* ── Page 1 ── */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: 2,
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Page 1 of {pageCount}
        </div>
        <div id="cv-preview-page-1" style={pageStyle}>
          <CVPage1Content
            applicant={a}
            summary={summary}
            photoUrl={rasterPhoto || getApplicantPhoto(a)}
            pageCount={pageCount}
          />
        </div>
      </div>

      {/* ── Page 2 (if multi-page) ── */}
      {hasPage2 && (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -24,
              left: 2,
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Page 2 of 2
          </div>
          <div id="cv-preview-page-2" style={pageStyle}>
            <CVPage2Content
              applicant={a}
              customFields={effectiveCustom}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Legacy alias */
export const CVPreview = CVPreviewDoc;

// ─── Build Standalone HTML for External Display / Print ────────────────────────

export function buildCVHtml(
  a: ApplicantRecord,
  summaryOverride: string,
  customFields: { key: string; value: string }[],
  _preparedBy: string,
  _cvId?: number,
  resolvedPhotoUrl?: string,
): string {
  const summary =
    summaryOverride.trim() ||
    `Experienced ${a.role || a.appliedRole || 'professional'} seeking overseas employment opportunities.`;

  const photoSrc = resolvedPhotoUrl || getApplicantPhoto(a);

  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" alt="photo" style="width:192px;height:192px;object-fit:cover;border:1px solid #000;display:block;flex-shrink:0;" />`
    : `<div style="width:192px;height:192px;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;text-align:center;background:#f9f9f9;flex-shrink:0;">2&times;2<br/>Photo</div>`;

  const infoLines = [
    a.name ? `<div style="font-weight:700;font-size:14px;margin-bottom:2px;">${a.name}</div>` : '',
    a.role || a.appliedRole
      ? `<div style="font-style:italic;margin-bottom:4px;color:#333;">${a.role || a.appliedRole}</div>`
      : '',
    a.presentAddress ? `<div><strong>Address:</strong> ${a.presentAddress}</div>` : '',
    a.email ? `<div><strong>Email:</strong> ${a.email}</div>` : '',
    a.contact ? `<div><strong>Mobile:</strong> ${a.contact}</div>` : '',
    a.facebookUrl ? `<div><strong>Facebook:</strong> <span style="word-break:break-all;">${a.facebookUrl}</span></div>` : '',
    a.whatsappNumber ? `<div><strong>WhatsApp:</strong> ${a.whatsappNumber}</div>` : '',
    a.linkedinUrl ? `<div><strong>LinkedIn:</strong> <span style="word-break:break-all;">${a.linkedinUrl}</span></div>` : '',
  ].filter(Boolean).join('');

  const pf = (label: string, val?: string | number | null) =>
    val !== undefined && val !== null && val !== ''
      ? `<div class="pf"><span class="pfl">${label}</span><span class="pfv">:&nbsp;&nbsp;${val}</span></div>`
      : '';

  const profileHtml = [
    pf('Full Name', a.name),
    pf('Date of Birth', a.dateOfBirth),
    pf('Place of Birth', a.placeOfBirth),
    pf('Age', a.age ? `${a.age} years old` : undefined),
    pf('Sex', a.sex),
    pf('Civil Status', a.civilStatus),
    pf('No. of Children', a.noOfChildren !== undefined && a.noOfChildren !== null ? String(a.noOfChildren) : undefined),
    pf('Religion', a.religion),
    pf('Citizenship', a.citizenship || 'Filipino'),
    pf('Height', a.heightCm ? `${a.heightCm} cm` : undefined),
    pf('Weight', a.weightKg ? `${a.weightKg} kg` : undefined),
    pf('Present Address', a.presentAddress),
    pf('Provincial Address', a.provincialAddress),
    pf('Email Address', a.email),
    pf('Mobile No.', a.contact),
    a.facebookUrl ? pf('Facebook', a.facebookUrl) : '',
    a.whatsappNumber ? pf('WhatsApp', a.whatsappNumber) : '',
    a.linkedinUrl ? pf('LinkedIn', a.linkedinUrl) : '',
    (a.languagesSpoken || []).length
      ? pf('Languages Spoken', (a.languagesSpoken || []).join(', '))
      : '',
    pf('Applied Position', a.role || a.appliedRole),
    pf('Applicant Code', a.applicantCode),
    a.emergencyContactName
      ? `<div class="pf-sub">Emergency Contact</div>
         ${pf('Name', a.emergencyContactName)}
         ${pf('Relationship', a.emergencyContactRelationship)}
         ${pf('Contact No.', a.emergencyContactNumber)}`
      : '',
  ].join('');

  const edHtml = (a.education || [])
    .map(
      (ed) => `<div class="sub">
        <div class="sub-t">${ed.school}</div>
        <div class="sub-s">${ed.level}${ed.course ? ` — ${ed.course}` : ''}</div>
        ${ed.yearGraduated ? `<div class="sub-m">Year Graduated: ${ed.yearGraduated}</div>` : ''}
      </div>`,
    )
    .join('');

  const empHtml = (a.employmentHistory || [])
    .map(
      (e) => `<div class="sub">
        <div class="sub-t">${e.company}</div>
        <div class="sub-s">${e.position}</div>
        <div class="sub-m">${e.dateStarted} – ${e.isPresent ? 'Present' : e.dateEnded}${e.country ? `, ${e.country}` : ''}</div>
        ${e.reasonForLeaving ? `<div class="sub-m">Reason for leaving: ${e.reasonForLeaving}</div>` : ''}
      </div>`,
    )
    .join('');

  const skillsHtml = (a.skills || []).length
    ? `<ol>${(a.skills || []).map((s) => `<li>${s}</li>`).join('')}</ol>`
    : '';

  const langHtml = (a.languageRecords || []).length
    ? `<ol>${(a.languageRecords || [])
        .map((l) => `<li>${l.language} — Spoken: ${l.spokenRating}/5, Written: ${l.writtenRating}/5</li>`)
        .join('')}</ol>`
    : '';

  const certHtml = (a.certifications || []).length
    ? `<ol>${(a.certifications || []).map((c) => `<li>${c}</li>`).join('')}</ol>`
    : '';

  const effectiveCustom = (customFields || []).filter((f) => f.key && f.key.trim());
  const customHtml = effectiveCustom.length
    ? effectiveCustom.map((f) => pf(f.key, f.value)).join('')
    : '';

  const sec = (label: string, content: string) =>
    content
      ? `<div class="sec">
           <div class="sec-h">${label}</div>
           <div class="sec-rule"></div>
           <div class="sec-body">${content}</div>
         </div>`
      : '';

  const hasPage2 =
    (a.employmentHistory || []).length > 0 ||
    (a.skills || []).length > 0 ||
    (a.languageRecords || []).length > 0 ||
    (a.certifications || []).length > 0 ||
    effectiveCustom.length > 0;

  const pageCount = hasPage2 ? 2 : 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>CV – ${a.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{
  font-family:Arial,'Helvetica Neue',sans-serif;
  font-size:10px;
  color:#000;
  line-height:1.65;
  background:#f1f5f9;
}
.cv-page{
  width:794px;
  min-height:1123px;
  height:1123px;
  padding:48px;
  margin:20px auto;
  background:#fff;
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  box-shadow:0 4px 16px rgba(0,0,0,0.15);
}
/* Header */
.hdr{display:flex;align-items:flex-start;gap:20px;margin-bottom:14px;}
.info{flex:1;font-size:10px;color:#111;line-height:1.75;}
/* Title */
.title-bar{border-top:2px solid #000;border-bottom:2px solid #000;padding:8px 0;margin-bottom:14px;text-align:center;}
.title-bar h1{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;line-height:1.3;padding:2px 0;color:#000;margin:0;}
/* Page 2 Header Rule */
.p2-hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #000;padding-bottom:7px;margin-bottom:14px;line-height:1.3;}
.p2-hdr-t{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;}
.p2-hdr-r{font-size:9.5px;color:#444;}
/* Sections */
.sec{margin-bottom:12px;}
.sec-h{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#000;padding-bottom:6px;border-bottom:1.5px solid #000;margin-bottom:6px;line-height:1.3;}
.sec-rule{display:none;}
.sec-body{padding-left:20px;font-size:10px;line-height:1.65;}
/* Profile fields */
.pf{display:flex;margin-bottom:2px;align-items:flex-start;}
.pfl{font-weight:700;min-width:190px;color:#000;flex-shrink:0;}
.pfv{color:#111;word-break:break-all;flex:1;}
.pf-sub{font-weight:700;font-size:10px;color:#000;margin-top:6px;margin-bottom:2px;}
/* Sub-items */
.sub{margin-bottom:7px;}
.sub-t{font-weight:700;color:#000;}
.sub-s{color:#222;}
.sub-m{font-size:9px;color:#444;}
ol{padding-left:16px;}li{margin-bottom:2px;}
/* Signature */
.sig{margin-top:28px;display:flex;justify-content:flex-end;}
.sig-line{text-align:center;min-width:230px;border-top:1px solid #000;padding-top:4px;font-size:9.5px;}
/* Footer */
.ftr{border-top:1px solid #ccc;padding-top:4px;margin-top:12px;display:flex;justify-content:space-between;font-size:8.5px;color:#555;}
@media print{
  body{background:#fff;}
  .cv-page{margin:0;box-shadow:none;page-break-after:always;height:100vh;}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
</style>
</head>
<body>

<!-- ═══ PAGE 1 ═══ -->
<div class="cv-page" id="cv-p1">
  <div>
    <div class="hdr">
      ${photoHtml}
      <div class="info">${infoLines}</div>
    </div>
    <div class="title-bar"><h1>Curriculum Vitae</h1></div>
    ${sec('Personal Information', profileHtml)}
    ${sec('Objective', `<p style="font-style:italic;color:#222;">${summary}</p>`)}
    ${sec('Education', edHtml)}
  </div>
  <div class="ftr">
    <span>Curriculum Vitae — ${a.name}</span>
    <span>Page 1 of ${pageCount}</span>
  </div>
</div>

${hasPage2 ? `
<!-- ═══ PAGE 2 ═══ -->
<div class="cv-page" id="cv-p2">
  <div>
    <div class="p2-hdr">
      <span class="p2-hdr-t">Curriculum Vitae — ${a.name}</span>
      <span class="p2-hdr-r">${a.applicantCode || a.role || a.appliedRole || ''}</span>
    </div>
    ${sec('Work Experience', empHtml)}
    ${sec('Skills', skillsHtml)}
    ${sec('Language Proficiency', langHtml)}
    ${sec('Certifications', certHtml)}
    ${sec('Additional Information', customHtml)}
    <div class="sig"><div class="sig-line">Applicant's Signature over Printed Name</div></div>
  </div>
  <div class="ftr">
    <span>Curriculum Vitae — ${a.name}</span>
    <span>Page 2 of 2</span>
  </div>
</div>
` : ''}

</body>
</html>`;
}

// ─── Direct A4 PDF Download via jsPDF & html2canvas ───────────────────────────

export async function downloadCVPdf(
  a: ApplicantRecord,
  summaryOverride: string = '',
  customFields: { key: string; value: string }[] = [],
  _preparedBy: string = 'Staff',
  _cvId?: number,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const html2canvasModule = await import('html2canvas');
  const html2canvas = (html2canvasModule as any).default || html2canvasModule;

  if (typeof window !== 'undefined') {
    (window as any).html2canvas = html2canvas;
  }

  // 1. Resolve raw photo and pre-convert to raster PNG Data URL
  const rawPhoto = getApplicantPhoto(a);
  const rasterPhoto = await convertPhotoToRasterDataUrl(rawPhoto);

  const summary =
    summaryOverride?.trim() ||
    `Experienced ${a.role || a.appliedRole || 'professional'} seeking overseas employment opportunities.`;

  const effectiveCustom = (customFields || []).filter((f) => f.key && f.key.trim());

  const hasPage2 =
    (a.employmentHistory || []).length > 0 ||
    (a.skills || []).length > 0 ||
    (a.languageRecords || []).length > 0 ||
    (a.certifications || []).length > 0 ||
    effectiveCustom.length > 0;

  const pageCount = hasPage2 ? 2 : 1;

  // 2. Offscreen container for pixel-identical React rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = `${A4_W}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  document.body.appendChild(container);

  const pagePdfStyle: React.CSSProperties = {
    width: A4_W,
    height: A4_H,
    minHeight: A4_H,
    maxHeight: A4_H,
    background: '#ffffff',
    fontFamily: "Arial, 'Helvetica Neue', sans-serif",
    color: '#000000',
    padding: PAGE_PAD,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  };

  const root = createRoot(container);

  try {
    // 3. Render the exact same React components as the preview
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ width: A4_W, background: '#ffffff', color: '#000000' }}>
          <div id="pdf-cv-page-1" style={pagePdfStyle}>
            <CVPage1Content
              applicant={a}
              summary={summary}
              photoUrl={rasterPhoto}
              pageCount={pageCount}
            />
          </div>
          {hasPage2 && (
            <div id="pdf-cv-page-2" style={pagePdfStyle}>
              <CVPage2Content
                applicant={a}
                customFields={effectiveCustom}
              />
            </div>
          )}
        </div>
      );
      setTimeout(resolve, 150);
    });

    // 4. Ensure document fonts are loaded
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }

    // 5. Wait for any images inside container to finish loading
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(img => img.complete ? Promise.resolve() : new Promise(res => {
          img.onload = res;
          img.onerror = res;
        }))
      );
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 6. Capture Page 1
    const p1El = container.querySelector('#pdf-cv-page-1') as HTMLElement;
    if (p1El) {
      const canvas1 = await html2canvas(p1El, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: A4_W,
        height: A4_H,
        windowWidth: A4_W,
      });
      const img1 = canvas1.toDataURL('image/jpeg', 0.98);
      pdf.addImage(img1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // 7. Capture Page 2 if present
    if (hasPage2) {
      const p2El = container.querySelector('#pdf-cv-page-2') as HTMLElement;
      if (p2El) {
        pdf.addPage();
        const canvas2 = await html2canvas(p2El, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: A4_W,
          height: A4_H,
          windowWidth: A4_W,
        });
        const img2 = canvas2.toDataURL('image/jpeg', 0.98);
        pdf.addImage(img2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
    }

    const safeName = (a.name || 'Applicant')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_');
    pdf.save(`CV-${safeName}.pdf`);
  } finally {
    try {
      root.unmount();
    } catch {}
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

