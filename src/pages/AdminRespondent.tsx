import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GapBadge } from "@/components/ui/GapBadge";
import { ArrowLeft, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "motion/react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const radarData = [
  { subject: "Producer (P)", is: 40, should: 30, want: 45, fullMark: 50 },
  { subject: "Administrator (A)", is: 35, should: 40, want: 30, fullMark: 50 },
  { subject: "Entrepreneur (E)", is: 20, should: 35, want: 40, fullMark: 50 },
  { subject: "Integrator (I)", is: 45, should: 40, want: 35, fullMark: 50 },
];

const gapData = [
  { name: "Producer", is: 40, should: 30, gap: 10 },
  { name: "Administrator", is: 35, should: 40, gap: -5 },
  { name: "Entrepreneur", is: 20, should: 35, gap: -15 },
  { name: "Integrator", is: 45, should: 40, gap: 5 },
];

export function AdminRespondent() {
  const { id } = useParams();

  return (
    <div className="p-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <Link to="/admin/cohorts/1" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohort
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                Sarah Jenkins
              </h1>
              <p className="text-gray-500 mt-1">sarah@example.com • Completed March 5, 2026</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                <Badge variant="P" className="text-lg px-2 py-0.5">P</Badge>
                <Badge variant="A" className="text-lg px-2 py-0.5">A</Badge>
                <Badge variant="outline" className="text-lg px-2 py-0.5 bg-gray-100">e</Badge>
                <Badge variant="I" className="text-lg px-2 py-0.5">I</Badge>
              </div>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" /> PDF Report
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radar Chart Section */}
          <Card className="h-full shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Style Comparison <Info className="h-4 w-4 text-gray-400" />
              </CardTitle>
              <CardDescription>
                Visual representation of Is, Should, and Want profiles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: '#9ca3af' }} />
                    <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                    <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.4} />
                    <Radar name="Want" dataKey="want" stroke="#E87722" fill="#E87722" fillOpacity={0.4} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gap Analysis Section */}
          <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle>Gap Analysis</CardTitle>
              <CardDescription>
                Differences between current behavior (Is) and job demands (Should).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gapData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" domain={[0, 50]} tick={{ fill: '#9ca3af' }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} width={100} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="is" name="Is" fill="#C8102E" radius={[0, 4, 4, 0]} barSize={16} />
                    <Bar dataKey="should" name="Should" fill="#1D3557" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 text-sm uppercase tracking-wider mb-4">Significant Gaps</h4>
                {gapData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">{item.name}</span>
                    <GapBadge gap={item.gap} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
