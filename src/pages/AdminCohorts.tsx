import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Plus, Users, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

const mockCohorts = [
  { id: "1", name: "Executive Leadership Team", members: 12, completed: 10, date: "2026-03-01" },
  { id: "2", name: "Engineering Managers", members: 24, completed: 24, date: "2026-02-15" },
  { id: "3", name: "Sales Q1 Onboarding", members: 8, completed: 2, date: "2026-03-08" },
];

export function AdminCohorts() {
  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-900">
            Cohorts
          </h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Cohort
          </Button>
        </div>

        <div className="grid gap-6">
          {mockCohorts.map((cohort) => (
            <Card key={cohort.id} className="hover:border-primary-light transition-colors shadow-sm">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{cohort.name}</h3>
                    <p className="text-sm text-gray-500">Created {cohort.date}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{cohort.completed} / {cohort.members}</p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${(cohort.completed / cohort.members) * 100}%` }}
                    />
                  </div>
                  <Link to={`/admin/cohorts/${cohort.id}`}>
                    <Button variant="outline" size="sm">
                      View <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
